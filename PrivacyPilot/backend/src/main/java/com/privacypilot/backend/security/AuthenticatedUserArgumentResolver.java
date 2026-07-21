package com.privacypilot.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.core.MethodParameter;

/**
 * Injects the {@link AuthenticatedUser} into any controller method that declares it
 * as a parameter, resolving the identity from RegulaOne on each request.
 *
 * Declaring an {@code AuthenticatedUser} parameter is therefore ALSO the auth gate:
 * if the caller has no valid session the resolver raises 401/403 before the controller
 * body runs. Inside the method, call {@code caller.requireAnyPermission(...)} to
 * enforce which PrivacyPilot roles may perform the action.
 */
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
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No request context available");
        }
        // Delegates to RegulaOne /api/auth/me (forwards the idToken cookie); cached in the client.
        return authClient.resolve(request);
    }
}
