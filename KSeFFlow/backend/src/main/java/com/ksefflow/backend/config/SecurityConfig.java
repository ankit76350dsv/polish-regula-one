package com.ksefflow.backend.config;

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

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

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
                        .requestMatchers("/api/v1/**").permitAll()

             

                    
                        .anyRequest().authenticated());

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


    

  
    

    
}
