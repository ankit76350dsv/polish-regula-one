package com.regulaone.backend.notification;

import com.regulaone.backend.models.User;
import com.regulaone.backend.models.notification.enums.SourceModule;
import com.regulaone.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Works out WHOSE notifications a request is allowed to touch, and IN WHICH APP.
 *
 * Every notification endpoint needs the same three facts before it can do anything: the
 * caller's company, the caller's user id, and which application they are acting inside.
 * All three are derived from the verified session token and the query string — never from
 * anything the caller could claim about themselves.
 *
 * WHY THIS IS NOT DONE IN THE CONTROLLER ANY MORE
 *   The controller used to hold a UserRepository and repeat the same three lines at the
 *   top of ten methods. Two problems with that: a controller reaching straight into the
 *   database skips the service layer, and a rule repeated ten times is a rule that can be
 *   forgotten on the eleventh method. Now every endpoint starts with one call to
 *   {@link #resolve}, and forgetting it is obvious.
 *
 * THE THREE CHECKS, AND WHY EACH IS AN ERROR
 *   * unknown user     → 401. The token verified, but there is no RegulaOne account behind
 *                        it, so there is nothing this person may see.
 *   * no organisation  → 403. Notifications only exist inside a company.
 *   * missing/unknown  → 400. Each app must declare which application it is acting within,
 *     module              so an app can never read or act on another app's notifications.
 */
@Component
@RequiredArgsConstructor
public class NotificationScopeResolver {

    private final UserRepository userRepository;

    /**
     * The caller's scope, restricted to ONE application.
     *
     * @param moduleParam the {@code module} query parameter, e.g. "KSEFFLOW" (mandatory)
     */
    public Scope resolve(Jwt jwt, String moduleParam) {
        User caller = requireUser(jwt);
        return new Scope(requireTenantId(caller), caller.getId(), requireModule(moduleParam));
    }

    /**
     * The caller's scope with NO application filter — for the preference endpoints, which
     * are per-person settings rather than per-app data.
     */
    public Scope resolve(Jwt jwt) {
        User caller = requireUser(jwt);
        return new Scope(requireTenantId(caller), caller.getId(), null);
    }

    private User requireUser(Jwt jwt) {
        return userRepository.findByCognitoSub(jwt.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    /** A user with no organisation has no notifications scope. */
    private String requireTenantId(User user) {
        if (user.getTenant() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Your account is not associated with an organisation");
        }
        return user.getTenant().getId();
    }

    private SourceModule requireModule(String module) {
        if (module == null || module.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "module is required");
        }
        try {
            return SourceModule.valueOf(module.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid module");
        }
    }

    /**
     * The three facts, checked and safe to use.
     *
     * @param tenantId the caller's company
     * @param userId   the caller — notifications are only ever read or changed for
     *                 themselves, never for a colleague
     * @param module   the application being acted within, or null for per-person settings
     */
    public record Scope(String tenantId, String userId, SourceModule module) {
    }
}
