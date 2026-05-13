package com.regulaone.backend.dto.Tenant;

import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.TenantStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Read-only DTO returned by all Tenant API responses.
 * Mirrors the Tenant document but is decoupled from the entity
 * so internal fields can be added to the model without leaking to the API.
 */
@Data
@Builder
public class TenantResponse {

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
    private List<TenantModule> enabledModules;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * Maps a Tenant entity to a TenantResponse DTO.
     * All API responses go through this factory method to ensure consistency.
     */
    public static TenantResponse from(Tenant tenant) {
        return TenantResponse.builder()
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
                .enabledModules(tenant.getEnabledModules())
                .createdAt(tenant.getCreatedAt())
                .updatedAt(tenant.getUpdatedAt())
                .build();
    }
}
