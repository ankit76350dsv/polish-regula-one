package com.safevoice.backend.config;

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

    @Value("${cors.allowed-origins:http://localhost:1003}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        log.info("[filterChain]: Building SafeVoice security filter chain — CSRF disabled, STATELESS sessions, /api/v1/** permitAll");
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/**").permitAll()
                        // WebSocket (STOMP/SockJS) handshake must pass the HTTP filter freely —
                        // the real authentication happens later at the STOMP CONNECT frame
                        // (staff cookie-JWT or reporter access key), so leave the handshake open.
                        .requestMatchers("/ws/**").permitAll()
                        // Anonymous whistleblower endpoints: submitting a report, looking it up
                        // with the access key, and the case chat thread. These MUST be public —
                        // the reporter has no account and no login by design.
                        .requestMatchers(
                                "/api/safevoice/reports",
                                "/api/safevoice/reports/track",
                                "/api/safevoice/reports/*/messages",
                                "/api/safevoice/reports/*/attachments",
                                // Reporter downloads a file from their OWN thread; ownership is
                                // proven by the access key in the request body, not a login. This
                                // literal path is separate from the "*/attachments" pattern above.
                                "/api/safevoice/reports/attachments/download"
                        ).permitAll()
                        .anyRequest().authenticated());
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        for (String origin : allowedOrigins.split(",")) {
            String trimmed = origin.trim();
            config.addAllowedOrigin(trimmed);
            log.info("[corsConfigurationSource]: CORS allowed origin registered: {}", trimmed);
        }
        config.setAllowCredentials(true);
        config.addAllowedMethod("*");
        config.addAllowedHeader("*");
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
