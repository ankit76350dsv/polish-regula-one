package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.notification.NotificationResponse;
import com.regulaone.backend.dto.notification.UpdatePreferenceRequest;
import com.regulaone.backend.models.User;
import com.regulaone.backend.models.notification.NotificationPreference;
import com.regulaone.backend.models.notification.enums.SourceModule;
import com.regulaone.backend.repository.UserRepository;
import com.regulaone.backend.services.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * User-facing notification API. Every endpoint resolves the caller from the verified JWT
 * (idToken cookie) and is FORCED to that user's own tenantId + userId server-side — a user
 * can only ever see and act on their own notifications.
 */
@Slf4j
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    // Dev/QA only — when true, exposes POST /api/notifications/test (default off in prod).
    @Value("${notification.test.enabled:false}")
    private boolean testEndpointEnabled;

    // NOTE: `module` (the sourceModule, e.g. "KSEFFLOW") is MANDATORY on every notification
    // endpoint below. Each app must declare which application it is acting within; a missing or
    // unknown module is rejected with 400. This keeps notifications strictly scoped per app —
    // an app can never read or act on another app's notifications.

    // GET /api/notifications?module=&status=&page=&size=
    @GetMapping
    public ResponseEntity<AppResponse<Page<NotificationResponse>>> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        User u = currentUser(jwt);
        Page<NotificationResponse> page = notificationService.list(tenantId(u), u.getId(), requireModule(module), status, pageable);
        return ResponseEntity.ok(AppResponse.success("Notifications loaded", page));
    }

    // GET /api/notifications/unread-count?module=
    @GetMapping("/unread-count")
    public ResponseEntity<AppResponse<Map<String, Long>>> unreadCount(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String module) {
        User u = currentUser(jwt);
        long count = notificationService.unreadCount(tenantId(u), u.getId(), requireModule(module));
        return ResponseEntity.ok(AppResponse.success("Unread count", Map.of("unread", count)));
    }

    // GET /api/notifications/{id}?module=
    @GetMapping("/{id}")
    public ResponseEntity<AppResponse<NotificationResponse>> get(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id,
            @RequestParam(required = false) String module) {
        User u = currentUser(jwt);
        return ResponseEntity.ok(AppResponse.success("Notification",
                notificationService.get(tenantId(u), u.getId(), requireModule(module), id)));
    }

    // PATCH /api/notifications/{id}/read?module=
    @PatchMapping("/{id}/read")
    public ResponseEntity<AppResponse<NotificationResponse>> markRead(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id,
            @RequestParam(required = false) String module) {
        User u = currentUser(jwt);
        return ResponseEntity.ok(AppResponse.success("Marked read",
                notificationService.markRead(tenantId(u), u.getId(), requireModule(module), id)));
    }

    // PATCH /api/notifications/read-all?module=
    @PatchMapping("/read-all")
    public ResponseEntity<AppResponse<Map<String, Integer>>> markAllRead(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String module) {
        User u = currentUser(jwt);
        int updated = notificationService.markAllRead(tenantId(u), u.getId(), requireModule(module));
        return ResponseEntity.ok(AppResponse.success("All marked read", Map.of("updated", updated)));
    }

    // PATCH /api/notifications/{id}/archive?module=
    @PatchMapping("/{id}/archive")
    public ResponseEntity<AppResponse<NotificationResponse>> archive(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id,
            @RequestParam(required = false) String module) {
        User u = currentUser(jwt);
        return ResponseEntity.ok(AppResponse.success("Archived",
                notificationService.archive(tenantId(u), u.getId(), requireModule(module), id)));
    }

    // DELETE /api/notifications/{id}?module=
    @DeleteMapping("/{id}")
    public ResponseEntity<AppResponse<Void>> delete(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id,
            @RequestParam(required = false) String module) {
        User u = currentUser(jwt);
        notificationService.delete(tenantId(u), u.getId(), requireModule(module), id);
        return ResponseEntity.ok(AppResponse.success("Deleted"));
    }

    // GET /api/notifications/preferences
    @GetMapping("/preferences")
    public ResponseEntity<AppResponse<NotificationPreference>> getPreferences(@AuthenticationPrincipal Jwt jwt) {
        User u = currentUser(jwt);
        return ResponseEntity.ok(AppResponse.success("Preferences", notificationService.getPreferences(tenantId(u), u.getId())));
    }

    // PUT /api/notifications/preferences
    @PutMapping("/preferences")
    public ResponseEntity<AppResponse<NotificationPreference>> updatePreferences(
            @AuthenticationPrincipal Jwt jwt, @RequestBody UpdatePreferenceRequest request) {
        User u = currentUser(jwt);
        return ResponseEntity.ok(AppResponse.success("Preferences updated",
                notificationService.updatePreferences(tenantId(u), u.getId(), request)));
    }

    // POST /api/notifications/test  (dev/QA only)
    // Creates one sample notification per type for the CURRENT user, so the whole UI can be
    // exercised without a real business event. Disabled unless notification.test.enabled=true.
    @PostMapping("/test")
    public ResponseEntity<AppResponse<Map<String, Integer>>> sendTest(@AuthenticationPrincipal Jwt jwt) {
        if (!testEndpointEnabled) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Test notifications are disabled");
        }
        User u = currentUser(jwt);
        int created = notificationService.createSelfTestNotifications(tenantId(u), u.getId());
        return ResponseEntity.ok(AppResponse.success("Test notifications created", Map.of("created", created)));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<AppResponse<Void>> handleNotFound(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(AppResponse.error(e.getMessage(), "NOT_FOUND", 404));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

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

    private User currentUser(Jwt jwt) {
        return userRepository.findByCognitoSub(jwt.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    // tenantId from the user's organisation; a user with no tenant has no notifications scope.
    private String tenantId(User u) {
        if (u.getTenant() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your account is not associated with an organisation");
        }
        return u.getTenant().getId();
    }
}
