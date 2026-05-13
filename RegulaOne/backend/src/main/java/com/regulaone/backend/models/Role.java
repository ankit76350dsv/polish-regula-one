package com.regulaone.backend.models;

public enum Role {
    ROLE_USER,
    ROLE_ADMIN,

    // Added to support Tenant management operations (create/update/delete tenants).
    // ROLE_SUPER_ADMIN has platform-level authority — sits above ROLE_ADMIN.
    // Used by TenantController endpoints under /api/superadmin/**
    ROLE_SUPER_ADMIN
}
