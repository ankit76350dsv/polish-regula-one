package com.safevoice.backend.config;

import com.safevoice.backend.security.SessionAuthenticationFilter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
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
    public SecurityFilterChain filterChain(HttpSecurity http, SessionAuthenticationFilter sessionAuthFilter)
            throws Exception {
        log.info("[filterChain]: Building SafeVoice security filter chain — CSRF disabled, STATELESS sessions, "
                + "authenticated-by-default with an explicit public allow-list");
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // WebSocket (STOMP/SockJS) handshake must pass the HTTP filter freely —
                        // the real authentication happens later at the STOMP CONNECT frame
                        // (staff cookie session or reporter access key), so leave the handshake open.
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
                        // Let the framework's error dispatch through without auth.
                        .requestMatchers("/error").permitAll()
                        // EVERYTHING ELSE (notably the internal staff API /api/v1/**) requires a
                        // valid session. The SessionAuthenticationFilter below populates the
                        // security context for /api/v1/** so this is enforced even for a handler
                        // that forgets to declare an AuthenticatedUser parameter (defense in depth).
                        .anyRequest().authenticated())
                // Run BEFORE authorization (and after CORS) so the resolved caller is in the
                // context when access is decided — and a 401/403/503 short-circuit keeps CORS headers.
                .addFilterBefore(sessionAuthFilter, AuthorizationFilter.class)
                // For any request that reaches authorization unauthenticated, answer 401 JSON in
                // the frontend's envelope shape (instead of Spring's default HTML/redirect).
                .exceptionHandling(ex -> ex.authenticationEntryPoint(jsonAuthenticationEntryPoint()));
        return http.build();
    }

    // Spring Boot would otherwise auto-register the SessionAuthenticationFilter into the servlet
    // chain (matching every URL, and running BEFORE CORS). We add it to the security chain
    // ourselves, so disable the automatic registration to avoid it running twice / too early.
    @Bean
    public FilterRegistrationBean<SessionAuthenticationFilter> sessionAuthFilterRegistration(
            SessionAuthenticationFilter filter) {
        FilterRegistrationBean<SessionAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    // 401 in the { success, message, errorCode, status } envelope the frontend already reads.
    private AuthenticationEntryPoint jsonAuthenticationEntryPoint() {
        return (request, response, authException) -> {
            response.setStatus(401);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"success\":false,\"message\":\"Authentication required.\","
                            + "\"errorCode\":\"UNAUTHENTICATED\",\"status\":401}");
        };
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
