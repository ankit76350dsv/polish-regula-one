package com.privacypilot.backend.model.document;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Read-only view of an organisation (tenant) in the SHARED "tenants" collection.
 *
 * This is the SAME collection the RegulaOne platform manages — every module
 * (PrivacyPilot, SafeVoice, ...) points at the same MongoDB database. Companies
 * are created and managed in RegulaOne, so PrivacyPilot only READS from here and
 * NEVER writes it (edits happen on RegulaOne's company profile page).
 *
 * RegulaOne is the single source of truth for the company's LEGAL IDENTITY, so
 * PrivacyPilot reads those fields straight from this shared document (rather than
 * keeping its own copy) and uses them for the ROPA register header (Art. 30(1)(a))
 * and every notice / breach report (Art. 13(1)(a)). Any field RegulaOne does not
 * store is simply left null here.
 *
 * The id is a MongoDB ObjectId shown as its 24-character hex string.
 */
@Data
@Document(collection = "tenants")
public class Tenant {

    // The tenant id — the Mongo _id, exposed here as its hex string form.
    @Id
    private String id;

    // The company's legal name (Art. 30(1)(a) / 13(1)(a) controller identity).
    private String name;

    // Lifecycle state stored as the RegulaOne TenantStatus name:
    // "ACTIVE", "INACTIVE", or "SUSPENDED". Only ACTIVE tenants may use the app.
    private String status;

    // ── Company legal identity, owned & written by RegulaOne, read here ──────────
    // Polish tax id.
    private String nip;
    // Polish national registry number.
    private String regon;
    // Primary organisation contact e-mail.
    private String email;
    private String phone;
    // Registered office address, stored as three parts on the RegulaOne tenant.
    private String address;
    private String city;
    private String postalCode;
}
