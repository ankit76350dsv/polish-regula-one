package com.regulaone.backend.models;

/**
 * Represents the lifecycle state of a Tenant account.
 *
 * ACTIVE    — tenant is fully operational, all modules accessible
 * INACTIVE  — tenant has been deactivated (e.g. subscription ended), read-only
 * SUSPENDED — tenant is temporarily blocked (e.g. payment overdue or compliance violation)
 */
public enum TenantStatus {
    ACTIVE,
    INACTIVE,
    SUSPENDED
}
