package com.regulaone.backend.dto.Tenant;

import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Lean tenant DTO returned by GET /api/tenant/info (the current user's own org).
 *
 * Deliberately OMITS {@code currentPackage} and {@code packageHistory}: a normal
 * user viewing their own organisation does not need the full package catalogue /
 * billing history. Those fields remain available to the SuperAdmin endpoints via
 * the richer {@link TenantResponse}.
 */
@Data
@Builder
public class MyTenantResponse {

    private String id;
    private String name;
    private String nip;
    private String regon;
    private String email;
    private String phone;
    private String address;
    private String city;
    private String postalCode;
    private TenantStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static MyTenantResponse from(Tenant tenant) {
        return MyTenantResponse.builder()
                .id(tenant.getId())
                .name(tenant.getName())
                .nip(tenant.getNip())
                .regon(tenant.getRegon())
                .email(tenant.getEmail())
                .phone(tenant.getPhone())
                .address(tenant.getAddress())
                .city(tenant.getCity())
                .postalCode(tenant.getPostalCode())
                .status(tenant.getStatus())
                .createdAt(tenant.getCreatedAt())
                .updatedAt(tenant.getUpdatedAt())
                .build();
    }
}
