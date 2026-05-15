package com.regulaone.backend.configs;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

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
        http
                .csrf(csrf -> csrf.disable())
                // Added: apply the CORS configuration bean so preflight OPTIONS requests are handled
                // before any auth filter runs. Without this, the browser's preflight is rejected
                // with no Access-Control-Allow-Origin header and all real requests fail.
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/health/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()

                        // Added: allow Swagger UI and OpenAPI spec without authentication
                        // so developers can explore the API docs without logging in
                        .requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**").permitAll()

                        .requestMatchers("/api/admin/**").hasAuthority("ROLE_ADMIN")

                        // Added: ROLE_SUPER_ADMIN is required for tenant management operations.
                        // /api/superadmin/** is a separate route namespace so it is clearly
                        // distinct from regular admin operations and can have its own audit trail.
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
            config.addAllowedOrigin(origin.trim());
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
            response.setStatus(403);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(
                    "{\"message\": \"Access denied. You do not have permission to access this resource.\"}");
        };
    }

    // ! this will validate that token iuuse from the AWS
    @Bean
    public JwtDecoder jwtDecoder() {
        String jwksUri = String.format(
                "https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json",
                region, userPoolId);
        return NimbusJwtDecoder.withJwkSetUri(jwksUri).build();
    }
}
