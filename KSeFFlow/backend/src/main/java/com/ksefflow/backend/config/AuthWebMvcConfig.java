package com.ksefflow.backend.config;

import com.ksefflow.backend.security.AuthenticatedUserArgumentResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Registers the {@link AuthenticatedUserArgumentResolver} so controllers can
 * receive the authenticated caller as a method parameter. Kept separate from
 * {@link WebCorsConfig} — Spring aggregates all WebMvcConfigurer beans.
 *
 * NOTE: {@link #addArgumentResolvers} runs ONCE at application startup (while Spring
 * builds the MVC infrastructure), not per request. The registered resolver is what
 * executes on every request thereafter.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class AuthWebMvcConfig implements WebMvcConfigurer {

    private final AuthenticatedUserArgumentResolver authenticatedUserArgumentResolver;

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        log.info("[AuthWebMvcConfig] Registering AuthenticatedUserArgumentResolver "
                + "(startup, one-time) — controllers can now receive AuthenticatedUser params");
        resolvers.add(authenticatedUserArgumentResolver);
    }
}
