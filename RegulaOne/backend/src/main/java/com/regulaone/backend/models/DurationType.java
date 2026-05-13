package com.regulaone.backend.models;

/**
 * Defines how long an AppPackage subscription lasts.
 *
 * MONTHLY  — renews every calendar month
 * YEARLY   — renews every calendar year (typically discounted vs monthly)
 * LIFETIME — one-time purchase, no expiry enforced
 *
 * Used in AppPackage.durationType and displayed in billing/invoicing flows.
 */
public enum DurationType {
    DAYS,
    MONTHLY,
    YEARLY,
    LIFETIME
}
