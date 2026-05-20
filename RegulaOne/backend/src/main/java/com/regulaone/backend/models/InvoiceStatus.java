package com.regulaone.backend.models;

// Lifecycle states for a billing invoice.
// FREE   — generated automatically at org setup for the default (no-charge) plan
// PAID   — generated when a tenant purchases or changes to a paid plan
// PENDING — reserved for future async payment processing (e.g. Stripe webhook confirmation)
public enum InvoiceStatus {
    FREE,
    PAID,
    PENDING
}
