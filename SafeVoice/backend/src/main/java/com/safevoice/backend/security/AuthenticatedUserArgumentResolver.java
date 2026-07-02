package com.safevoice.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.server.ResponseStatusException;

/**
 * Injects the {@link AuthenticatedUser} into any controller method that declares it as a
 * parameter, resolving the identity from RegulaOne on each request.
 *
 * Declaring an {@code AuthenticatedUser} parameter is therefore also the auth gate: if the
 * caller has no valid session the resolver raises 401/403 before the controller body runs.
 * Inside the method, call {@code caller.requireAnyPermission(...)} to enforce which SafeVoice
 * roles may perform the action.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthenticatedUserArgumentResolver implements HandlerMethodArgumentResolver {

    private final RegulaOneAuthClient authClient;

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return AuthenticatedUser.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                  ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) {
        // The SessionAuthenticationFilter has already resolved and validated the caller for
        // /api/v1/** and put them in the security context, so read them straight from there —
        // this avoids a second /api/auth/me round trip per request.
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        // Fallback (e.g. a caller outside the filtered path): resolve directly. Delegates to
        // RegulaOne /api/auth/me (forwards the idToken cookie); result is cached in the client.
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No request context available");
        }
        return authClient.resolve(request);
    }
}
