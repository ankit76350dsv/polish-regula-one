package com.ksefflow.backend.controllers;

import com.ksefflow.backend.dto.ksefapi.PermissionsOperationStatusResponse;
import com.ksefflow.backend.dto.ksefapi.QueryPersonPermissionsResponse;
import com.ksefflow.backend.security.AuthenticatedUser;
import com.ksefflow.backend.services.KsefPermissionsService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

// REST API for KSeF permissions (uprawnienia), gap C2.
//
// Granting/revoking permissions is an administrative, legally significant action, so those
// endpoints are ADMIN-only. Listing permissions is allowed for any signed-in user so the UI
// can show "who can do what".
//
// The tenant is always taken from the verified caller. "nip" is the tenant's own NIP, used as
// the KSeF authentication context.
@RestController
@RequestMapping("/api/v1/permissions")
@RequiredArgsConstructor
@Slf4j
public class KsefPermissionsController {

    private final KsefPermissionsService permissionsService;

    // Body for granting permissions to a person.
    public record GrantPersonRequest(
            @NotBlank String subjectType,   // "Nip" | "Pesel" | "Fingerprint"
            @NotBlank String subjectValue,
            @NotEmpty List<String> permissions,
            @NotBlank String description,
            String subjectDetailsType) {}   // optional; defaults to "PersonByIdentifier"

    // Body for querying permissions.
    public record QueryRequest(String queryType, List<String> permissionTypes) {}

    // ── Grant (admin only) ────────────────────────────────────────────────────────

    @PostMapping("/persons/grants")
    public ResponseEntity<Map<String, String>> grant(
            AuthenticatedUser caller,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip,
            @RequestBody GrantPersonRequest body) {
        requireAdmin(caller);
        log.info("[grant]:1 POST /permissions/persons/grants — tenant={} subject={}:{}",
                caller.tenantId(), body.subjectType(), body.subjectValue());
        String ref = permissionsService.grantToPerson(caller.tenantId(), nip, body.subjectType(),
                body.subjectValue(), body.permissions(), body.description(), body.subjectDetailsType());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("referenceNumber", ref));
    }

    // ── Query (any authenticated user) ───────────────────────────────────────────

    @PostMapping("/query")
    public ResponseEntity<QueryPersonPermissionsResponse> query(
            AuthenticatedUser caller,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip,
            @RequestBody(required = false) QueryRequest body,
            @RequestParam(defaultValue = "0") int pageOffset,
            @RequestParam(defaultValue = "20") int pageSize) {
        log.info("[query]:1 POST /permissions/query — tenant={}", caller.tenantId());
        String queryType = body != null ? body.queryType() : null;
        List<String> types = body != null ? body.permissionTypes() : null;
        return ResponseEntity.ok(
                permissionsService.listPersonPermissions(caller.tenantId(), nip, queryType, types, pageOffset, pageSize));
    }

    // ── Revoke (admin only) ───────────────────────────────────────────────────────

    @DeleteMapping("/{permissionId}")
    public ResponseEntity<Map<String, String>> revoke(
            AuthenticatedUser caller,
            @PathVariable String permissionId,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip) {
        requireAdmin(caller);
        log.info("[revoke]:1 DELETE /permissions/{} — tenant={}", permissionId, caller.tenantId());
        String ref = permissionsService.revoke(caller.tenantId(), nip, permissionId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("referenceNumber", ref));
    }

    // ── Operation status (any authenticated user) ─────────────────────────────────

    @GetMapping("/operations/{referenceNumber}")
    public ResponseEntity<PermissionsOperationStatusResponse> operationStatus(
            AuthenticatedUser caller,
            @PathVariable String referenceNumber,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip) {
        log.info("[operationStatus]:1 GET /permissions/operations/{} — tenant={}", referenceNumber, caller.tenantId());
        return ResponseEntity.ok(permissionsService.getOperationStatus(caller.tenantId(), nip, referenceNumber));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────────

    private void requireAdmin(AuthenticatedUser caller) {
        String role = caller.role();
        boolean isAdmin = role != null && (role.contains("ADMIN") || role.contains("SUPER"));
        if (!isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only an administrator can change KSeF permissions");
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(e.getMessage());
    }
}
