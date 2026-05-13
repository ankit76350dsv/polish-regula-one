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
import org.springframework.security.web.SecurityFilterChain;

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
                        .requestMatchers("/api/admin/**").hasAuthority("ROLE_ADMIN")
                        .anyRequest().authenticated())

                // ! JWT authentication configuration
                .oauth2ResourceServer(oauth2 -> oauth2

                        // ? Extract JWT from cookies
                        .bearerTokenResolver(cookieBearerTokenResolver)

                        .jwt(jwt -> jwt

                                // ? Validate and decode Cognito JWT
                                .decoder(jwtDecoder())

                                // ? Convert JWT into Spring Security Authentication
                                // ? and load user roles from MongoDB
                                .jwtAuthenticationConverter(cognitoJwtConverter)));

        return http.build();
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
