package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.AppResponse;
import com.regulaone.backend.dto.Tenant.ChangeStatusRequest;
import com.regulaone.backend.dto.Tenant.MyTenantResponse;
import com.regulaone.backend.dto.Tenant.TenantPageResponse;
import com.regulaone.backend.dto.Tenant.TenantRequest;
import com.regulaone.backend.dto.Tenant.TenantResponse;
import com.regulaone.backend.models.TenantStatus;
import com.regulaone.backend.services.TenantService;
import com.regulaone.backend.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;
    private final UserService userService;

    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @PostMapping("/superadmin/tenant")
    public ResponseEntity<AppResponse<TenantResponse>> createTenant(
            @Valid @RequestBody TenantRequest request) {
        TenantResponse created = tenantService.createTenant(request);
        return ResponseEntity.status(201)
                .body(AppResponse.created("Tenant created successfully", created));
    }

    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @PutMapping("/superadmin/tenant/{id}")
    public ResponseEntity<AppResponse<TenantResponse>> updateTenant(
            @PathVariable String id,
            @Valid @RequestBody TenantRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Tenant updated successfully",
                tenantService.updateTenant(id, request)));
    }

    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @PatchMapping("/superadmin/tenant/{id}/status")
    public ResponseEntity<AppResponse<TenantResponse>> changeStatus(
            @PathVariable String id,
            @Valid @RequestBody ChangeStatusRequest request) {
        return ResponseEntity.ok(AppResponse.success(
                "Tenant status updated successfully",
                tenantService.changeStatus(id, request.getStatus())));
    }

    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    @DeleteMapping("/superadmin/tenant/{id}")
    public ResponseEntity<AppResponse<Void>> deleteTenant(@PathVariable String id) {
        tenantService.deleteTenant(id);
        return ResponseEntity.ok(AppResponse.success("Tenant deleted successfully."));
    }

    @GetMapping("/superadmin/tenants")
    public ResponseEntity<AppResponse<TenantPageResponse>> getAllTenants(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TenantStatus status,
            @RequestParam(defaultValue = "0")    int page,
            @RequestParam(defaultValue = "10")   int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        int safeSize = Math.min(size, 100);
        Sort.Direction direction = sortDir.equalsIgnoreCase("asc")
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, safeSize, Sort.by(direction, sortBy));

        return ResponseEntity.ok(AppResponse.success(
                "Tenants loaded",
                tenantService.getAllTenants(search, status, pageable)));
    }

    // Returns the tenant of the currently authenticated user.
    // The tenant id is derived from the JWT subject (never trusted from the client),
    // so a user can only ever load their own organisation — enforcing tenant isolation.
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/tenant/info")
    public ResponseEntity<AppResponse<MyTenantResponse>> getMyTenant(
            @AuthenticationPrincipal Jwt jwt) {
        String tenantId = userService.getCurrentUser(jwt.getSubject()).getTenantId();
        return ResponseEntity.ok(AppResponse.success(
                "Tenant loaded",
                tenantService.getMyTenantInfo(tenantId)));
    }
}
