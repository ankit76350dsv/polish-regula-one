package com.regulaone.backend.models;

/**
 * Represents the compliance modules that can be enabled for a Tenant.
 * Each value maps to a sub-application in the RegulaOne monorepo.
 *
 * KSEFFLOW    — e-invoicing (Polish KSeF mandate)
 * WORKPULSE   — employee time tracking (Polish Labour Code)
 * SAFEWORK    — HR/BHP workplace safety compliance
 * SAFEVOICE   — whistleblower reporting (Polish Whistleblower Protection Law)
 * WASTESYNC   — BDO environmental waste reporting
 * PRIVACYPILOT — GDPR/RODO data protection compliance
 */
public enum TenantModule {
    KSEFFLOW,
    WORKPULSE,
    SAFEWORK,
    SAFEVOICE,
    WASTESYNC,
    PRIVACYPILOT
}
