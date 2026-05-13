package com.regulaone.backend.models;

/**
 * Lifecycle state of an AppPackage.
 *
 * ACTIVE   — package is available for assignment to tenants
 * INACTIVE — package has been disabled by a super admin (hidden from new assignments)
 * EXPIRED  — package has passed its expiringDate; tenants lose access to included apps
 *
 * Separated from TenantStatus intentionally — a package expiring is distinct
 * from a tenant account being suspended.
 */
public enum PackageStatus {
    ACTIVE,
    INACTIVE,
    EXPIRED
}
