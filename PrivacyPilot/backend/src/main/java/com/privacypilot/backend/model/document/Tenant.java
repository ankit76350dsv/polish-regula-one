package com.privacypilot.backend.model.document;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Read-only view of an organisation (tenant) in the SHARED "tenants" collection.
 *
 * This is the SAME collection the RegulaOne platform manages — every module
 * (PrivacyPilot, SafeVoice, ...) points at the same MongoDB database. Companies
 * are created and managed in RegulaOne, so PrivacyPilot only READS the few
 * fields it needs and lets MongoDB ignore the rest of the document.
 *
 * The id is a MongoDB ObjectId shown as its 24-character hex string.
 */
@Data
@Document(collection = "tenants")
public class Tenant {

    // The tenant id — the Mongo _id, exposed here as its hex string form.
    @Id
    private String id;

    // The company's legal name, kept for readable logs and admin screens.
    private String name;

    // Lifecycle state stored as the RegulaOne TenantStatus name:
    // "ACTIVE", "INACTIVE", or "SUSPENDED". Only ACTIVE tenants may use the app.
    private String status;
}
