package com.privacypilot.backend.config;

import com.privacypilot.backend.security.AuthenticatedUserArgumentResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Web wiring for PrivacyPilot:
 *   1. Registers the {@link AuthenticatedUserArgumentResolver} so any controller can
 *      receive the signed-in caller just by declaring an {@code AuthenticatedUser} param.
 *   2. Configures CORS so the PrivacyPilot frontend (a different origin in dev) can call
 *      this API WITH the shared session cookie (allowCredentials = true).
 */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final AuthenticatedUserArgumentResolver authenticatedUserArgumentResolver;

    // Comma-separated list of allowed frontend origins — set per environment in properties.
    @Value("${privacypilot.cors.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(authenticatedUserArgumentResolver);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.split("\\s*,\\s*"))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                // The session lives in a shared httpOnly cookie, so credentials MUST be allowed.
                .allowCredentials(true);
    }
}
