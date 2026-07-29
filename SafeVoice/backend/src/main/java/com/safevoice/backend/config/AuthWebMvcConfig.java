package com.safevoice.backend.config;

import com.safevoice.backend.security.AuthenticatedUserArgumentResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Registers the {@link AuthenticatedUserArgumentResolver} so any controller can receive the
 * authenticated caller simply by declaring an {@code AuthenticatedUser} parameter.
 *
 * Runs once at startup (while Spring builds the MVC infrastructure); the registered resolver
 * then runs on every request that needs it.
 */
@Configuration
@RequiredArgsConstructor
public class AuthWebMvcConfig implements WebMvcConfigurer {

    private final AuthenticatedUserArgumentResolver authenticatedUserArgumentResolver;

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(authenticatedUserArgumentResolver);
    }
}
