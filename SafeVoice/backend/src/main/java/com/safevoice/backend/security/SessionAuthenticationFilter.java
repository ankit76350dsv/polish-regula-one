package com.safevoice.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

/**
 * Enforces authentication on the internal staff API (`/api/v1/**`) at the SECURITY layer, so it
 * is authenticated-by-default.
 *
 * Previously auth existed only because each controller method declared an {@link AuthenticatedUser}
 * parameter (resolved by {@link AuthenticatedUserArgumentResolver}). That is fragile: a future
 * `/api/v1/**` handler that forgot the parameter would be silently public. This filter closes that
 * gap: it resolves the caller from the session cookie for every `/api/v1/**` request and puts them
 * in the Spring Security context, so {@code anyRequest().authenticated()} can enforce access even
 * for a handler that never looks at the user.
 *
 * It still produces the same nuanced statuses the argument resolver used to (401 invalid/missing
 * session, 403 no organisation, 503 RegulaOne unreachable) by short-circuiting the request itself.
 * On success the resolved user becomes the authentication principal, so the argument resolver reads
 * it straight from the context — no second /api/auth/me call.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SessionAuthenticationFilter extends OncePerRequestFilter {

    private static final String INTERNAL_PREFIX = "/api/v1/";

    private final RegulaOneAuthClient authClient;

    // Only guard the internal staff API. Public reporter endpoints and /ws stay open here (they
    // have their own credential checks); skip CORS preflight so it is never blocked.
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod())
                || !request.getRequestURI().startsWith(INTERNAL_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            AuthenticatedUser user = authClient.resolve(request); // throws 401 / 403 / 503
            // Authenticated token; principal is the resolved user (read later by the resolver).
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(user, null, List.of());
            SecurityContextHolder.getContext().setAuthentication(auth);
        } catch (ResponseStatusException e) {
            SecurityContextHolder.clearContext();
            writeError(response, e);
            return; // short-circuit — do not reach the controller
        }
        chain.doFilter(request, response);
    }

    // Write the auth failure in the { success, message, errorCode, status } envelope the frontend
    // already understands, preserving the exact status (401/403/503).
    private void writeError(HttpServletResponse response, ResponseStatusException e) throws IOException {
        int status = e.getStatusCode().value();
        String errorCode = switch (status) {
            case 403 -> "FORBIDDEN";
            case 503 -> "SERVICE_UNAVAILABLE";
            default -> "UNAUTHENTICATED";
        };
        String message = e.getReason() != null ? e.getReason() : "Authentication required";
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"success\":false,\"message\":\"" + message + "\","
                        + "\"errorCode\":\"" + errorCode + "\",\"status\":" + status + "}");
    }
}
