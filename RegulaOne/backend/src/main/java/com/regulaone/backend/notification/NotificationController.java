package com.regulaone.backend.notification;

import com.regulaone.backend.common.AppResponse;
import com.regulaone.backend.models.notification.NotificationPreference;
import com.regulaone.backend.notification.NotificationScopeResolver.Scope;
import com.regulaone.backend.notification.dto.NotificationResponse;
import com.regulaone.backend.notification.dto.UpdatePreferenceRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * The signed-in person's own notifications.
 *
 *   GET    /api/notifications                 my notifications, paged and filterable
 *   GET    /api/notifications/unread-count     the badge number
 *   GET    /api/notifications/{id}             one notification
 *   PATCH  /api/notifications/{id}/read        mark it read
 *   PATCH  /api/notifications/read-all         mark everything read
 *   PATCH  /api/notifications/{id}/archive     put it out of the way
 *   DELETE /api/notifications/{id}             remove it (a soft delete)
 *   GET    /api/notifications/preferences      how I want to be told things
 *   PUT    /api/notifications/preferences      change that
 *   POST   /api/notifications/test             dev/QA only — see below
 *
 * ── THE TWO RULES EVERY ENDPOINT HERE OBEYS ─────────────────────────────────────
 *
 * 1. ONLY MY OWN. The caller is resolved from the verified JWT (the idToken cookie) and
 *    every call is FORCED to that person's own company and user id, server-side. There is
 *    no path or query parameter that could point at somebody else's mailbox.
 *
 * 2. ONE APP AT A TIME. The {@code module} parameter (e.g. "KSEFFLOW") is MANDATORY on every
 *    data endpoint: each application must declare which app it is acting within, and a
 *    missing or unknown value is rejected with 400. That is what stops one app reading or
 *    clearing another app's notifications. (The preference endpoints are the exception —
 *    they are per-person settings, not per-app data.)
 *
 * Both rules are applied by {@link NotificationScopeResolver}, which every method calls
 * first. Nothing here touches a repository directly.
 */
@Slf4j
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationScopeResolver scopeResolver;

    // Dev/QA only — when true, exposes POST /api/notifications/test (default off in prod).
    @Value("${notification.test.enabled:false}")
    private boolean testEndpointEnabled;

    // ── Reading ───────────────────────────────────────────────────────────────

    // GET /api/notifications?module=&status=&page=&size=
    @GetMapping
    public ResponseEntity<AppResponse<Page<NotificationResponse>>> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        Scope me = scopeResolver.resolve(jwt, module);
        Page<NotificationResponse> page =
                notificationService.list(me.tenantId(), me.userId(), me.module(), status, pageable);
        return ResponseEntity.ok(AppResponse.success("Notifications loaded", page));
    }

    // GET /api/notifications/unread-count?module=
    @GetMapping("/unread-count")
    public ResponseEntity<AppResponse<Map<String, Long>>> unreadCount(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String module) {
        Scope me = scopeResolver.resolve(jwt, module);
        long count = notificationService.unreadCount(me.tenantId(), me.userId(), me.module());
        return ResponseEntity.ok(AppResponse.success("Unread count", Map.of("unread", count)));
    }

    // GET /api/notifications/{id}?module=
    @GetMapping("/{id}")
    public ResponseEntity<AppResponse<NotificationResponse>> get(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id,
            @RequestParam(required = false) String module) {
        Scope me = scopeResolver.resolve(jwt, module);
        return ResponseEntity.ok(AppResponse.success("Notification",
                notificationService.get(me.tenantId(), me.userId(), me.module(), id)));
    }

    // ── Acting on one, or on all ──────────────────────────────────────────────

    // PATCH /api/notifications/{id}/read?module=
    @PatchMapping("/{id}/read")
    public ResponseEntity<AppResponse<NotificationResponse>> markRead(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id,
            @RequestParam(required = false) String module) {
        Scope me = scopeResolver.resolve(jwt, module);
        return ResponseEntity.ok(AppResponse.success("Marked read",
                notificationService.markRead(me.tenantId(), me.userId(), me.module(), id)));
    }

    // PATCH /api/notifications/read-all?module=
    @PatchMapping("/read-all")
    public ResponseEntity<AppResponse<Map<String, Integer>>> markAllRead(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String module) {
        Scope me = scopeResolver.resolve(jwt, module);
        int updated = notificationService.markAllRead(me.tenantId(), me.userId(), me.module());
        return ResponseEntity.ok(AppResponse.success("All marked read", Map.of("updated", updated)));
    }

    // PATCH /api/notifications/{id}/archive?module=
    @PatchMapping("/{id}/archive")
    public ResponseEntity<AppResponse<NotificationResponse>> archive(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id,
            @RequestParam(required = false) String module) {
        Scope me = scopeResolver.resolve(jwt, module);
        return ResponseEntity.ok(AppResponse.success("Archived",
                notificationService.archive(me.tenantId(), me.userId(), me.module(), id)));
    }

    // DELETE /api/notifications/{id}?module=
    @DeleteMapping("/{id}")
    public ResponseEntity<AppResponse<Void>> delete(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id,
            @RequestParam(required = false) String module) {
        Scope me = scopeResolver.resolve(jwt, module);
        notificationService.delete(me.tenantId(), me.userId(), me.module(), id);
        return ResponseEntity.ok(AppResponse.success("Deleted"));
    }

    // ── Preferences (no module: these are per-person, not per-app) ─────────────

    // GET /api/notifications/preferences
    @GetMapping("/preferences")
    public ResponseEntity<AppResponse<NotificationPreference>> getPreferences(
            @AuthenticationPrincipal Jwt jwt) {
        Scope me = scopeResolver.resolve(jwt);
        return ResponseEntity.ok(AppResponse.success("Preferences",
                notificationService.getPreferences(me.tenantId(), me.userId())));
    }

    // PUT /api/notifications/preferences
    @PutMapping("/preferences")
    public ResponseEntity<AppResponse<NotificationPreference>> updatePreferences(
            @AuthenticationPrincipal Jwt jwt, @RequestBody UpdatePreferenceRequest request) {
        Scope me = scopeResolver.resolve(jwt);
        return ResponseEntity.ok(AppResponse.success("Preferences updated",
                notificationService.updatePreferences(me.tenantId(), me.userId(), request)));
    }

    // ── Dev/QA helper ─────────────────────────────────────────────────────────

    // POST /api/notifications/test  (dev/QA only)
    // Creates one sample notification per type for the CURRENT user, so the whole UI can be
    // exercised without a real business event. Disabled unless notification.test.enabled=true.
    @PostMapping("/test")
    public ResponseEntity<AppResponse<Map<String, Integer>>> sendTest(
            @AuthenticationPrincipal Jwt jwt) {
        if (!testEndpointEnabled) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Test notifications are disabled");
        }
        Scope me = scopeResolver.resolve(jwt);
        int created = notificationService.createSelfTestNotifications(me.tenantId(), me.userId());
        return ResponseEntity.ok(AppResponse.success("Test notifications created",
                Map.of("created", created)));
    }

    /**
     * "Not found" for this controller only.
     *
     * NotificationService signals a missing (or not-yours) notification with an
     * IllegalArgumentException. The global handler maps that to 400, which would be wrong
     * here — asking for a notification that is not yours must look exactly like asking for
     * one that does not exist, or the answer itself would reveal that it exists.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<AppResponse<Void>> handleNotFound(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(AppResponse.error(e.getMessage(), "NOT_FOUND", 404));
    }
}
