package com.regulaone.backend.configs;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CognitoJwtConverter cognitoJwtConverter;
    private final CookieBearerTokenResolver cookieBearerTokenResolver;

    @Value("${aws.cognito.region}")
    private String region;

    @Value("${aws.cognito.user-pool-id}")
    private String userPoolId;

    // Comma-separated list of allowed frontend origins — set per environment in application*.properties.
    // Must be an explicit origin (not *) because credentials: true requires a known origin.
    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        log.info("[SecurityConfig] Building security filter chain — stateless JWT mode");
        http
                .csrf(csrf -> csrf.disable())
                // Added: apply the CORS configuration bean so preflight OPTIONS requests are handled
                // before any auth filter runs. Without this, the browser's preflight is rejected
                // with no Access-Control-Allow-Origin header and all real requests fail.
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/health/**").permitAll()
                        // Spring's error handler redirects to /error — must be public or
                        // the redirect itself gets a 401 and hides the real error response.
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()

                        // SSO endpoints that must be public — no token exists at this point.
                        // GET  /api/sso/login           — redirect to central login page
                        // POST /api/sso/login           — authenticate with credentials
                        // POST /api/sso/respond-challenge — complete NEW_PASSWORD_REQUIRED challenge
                        // POST /api/sso/refresh         — silent token refresh (idToken expired)
                        .requestMatchers("/api/sso/login").permitAll()
                        .requestMatchers("/api/sso/respond-challenge").permitAll()
                        .requestMatchers("/api/sso/refresh").permitAll()

                        // Internal service-to-service notification ingest — NOT user-authenticated.
                        // Guarded by the X-Service-Token header check inside NotificationIngestController.
                        .requestMatchers("/api/internal/**").permitAll()

                        // Allow Swagger UI and OpenAPI spec without authentication
                        .requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**").permitAll()

                        .requestMatchers("/api/admin/**").hasAuthority("ROLE_ADMIN")
                        .requestMatchers("/api/superadmin/**").hasAuthority("ROLE_SUPER_ADMIN")

                        .anyRequest().authenticated())

                // ! custom error responses for auth failures
                .exceptionHandling(ex -> ex
                        // ? no token or expired token → 401
                        .authenticationEntryPoint(authenticationEntryPoint())
                        // ? valid token but wrong role → 403
                        .accessDeniedHandler(accessDeniedHandler()))

                // ! JWT authentication configuration
                .oauth2ResourceServer(oauth2 -> oauth2

                        // ? Extract JWT from cookies
                        .bearerTokenResolver(cookieBearerTokenResolver)

                        // ? also catches invalid/expired token inside the oauth2 layer
                        .authenticationEntryPoint(authenticationEntryPoint())

                        .jwt(jwt -> jwt

                                // ? Validate and decode Cognito JWT
                                .decoder(jwtDecoder())

                                // ? Convert JWT into Spring Security Authentication
                                // ? and load user roles from MongoDB
                                .jwtAuthenticationConverter(cognitoJwtConverter)));

        return http.build();
    }

    // Added: CORS configuration source — called for every preflight and actual cross-origin request.
    // allowCredentials(true) is required so the browser includes HTTP-only cookies (idToken, accessToken).
    // The wildcard origin "*" cannot be used with allowCredentials(true); explicit origins are mandatory.
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Split the comma-separated list from application*.properties
        for (String origin : allowedOrigins.split(",")) {
            String trimmed = origin.trim();
            config.addAllowedOrigin(trimmed);
            log.info("[SecurityConfig] CORS allowed origin registered: {}", trimmed);
        }

        config.setAllowCredentials(true);
        config.addAllowedMethod("*");   // GET, POST, PUT, DELETE, OPTIONS, PATCH
        config.addAllowedHeader("*");   // Content-Type, Authorization, etc.
        config.setMaxAge(3600L);        // cache preflight response for 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    // ? called when token is missing, invalid, or expired → 401
    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) -> {
            log.warn("[SecurityConfig] 401 Unauthorized — method={} uri={} error={}",
                    request.getMethod(), request.getRequestURI(), authException.getMessage());
            response.setStatus(401);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(
                    "{\"message\": \"Session expired. Please log in to access this resource.\"}");
        };
    }

    // ? called when token is valid but user lacks the required role → 403
    @Bean
    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) -> {
            log.warn("[SecurityConfig] 403 Access Denied — method={} uri={} principal={} error={}",
                    request.getMethod(), request.getRequestURI(),
                    request.getUserPrincipal() != null ? request.getUserPrincipal().getName() : "unknown",
                    accessDeniedException.getMessage());
            response.setStatus(403);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(
                    "{\"message\": \"Access denied. You do not have permission to access this resource.\"}");
        };
    }

    // Validates JWT tokens issued by AWS Cognito.
    // Uses a RestTemplate with a 30-second connect/read timeout instead of the
    // default (which is very short). Without this, a slow or cold-start Cognito
    // JWKS endpoint causes a SocketTimeoutException → 401 on the first request
    // after the JWKS cache expires, forcing a silent refresh for every cold start.
    @Bean
    public JwtDecoder jwtDecoder() {
        String jwksUri = String.format(
                "https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json",
                region, userPoolId);
        log.info("[SecurityConfig] JwtDecoder configured — JWKS URI: {}", jwksUri);

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(30_000);
        factory.setReadTimeout(30_000);

        return NimbusJwtDecoder.withJwkSetUri(jwksUri)
                .restOperations(new RestTemplate(factory))
                .build();
    }
}
