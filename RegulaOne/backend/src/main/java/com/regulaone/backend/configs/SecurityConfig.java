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

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
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
