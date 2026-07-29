package com.privacypilot.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Clears the {@link CurrentUserContext} at the end of EVERY request.
 *
 * The user id is put into the context by the argument resolver while the request is
 * being handled. Server threads are reused between requests, so if we did not wipe the
 * value here, the next request that happened to run on the same thread could briefly
 * see the previous user's id. Wrapping the whole request in a try/finally guarantees
 * the id is always removed, even if the request fails.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CurrentUserContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            filterChain.doFilter(request, response);
        } finally {
            CurrentUserContext.clear();
        }
    }
}
