package com.ksefflow.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;



import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // Runs ONCE at startup while Spring Security builds the filter chain.
        log.info("[SecurityConfig] Building security filter chain — CSRF disabled, STATELESS sessions, "
                + "/api/v1/** is permitAll (auth is enforced per-request by AuthenticatedUserArgumentResolver "
                + "via the RegulaOne /me call)");
        http
                .csrf(csrf -> csrf.disable())
                // Added: apply the CORS configuration bean so preflight OPTIONS requests are handled
                // before any auth filter runs. Without this, the browser's preflight is rejected
                // with no Access-Control-Allow-Origin header and all real requests fail.
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/health/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/v1/**").permitAll()
                        .anyRequest().authenticated());

        log.info("[SecurityConfig] Security filter chain built successfully");
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
        log.info("[SecurityConfig] CORS source built — allowCredentials=true (cookies forwarded), maxAge=3600s");
        return source;
    }


    

  
    

    
}
