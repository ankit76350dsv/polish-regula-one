package com.safevoice.backend.model.document;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Read-only view of an organisation (tenant) in the SHARED "tenants" collection.
 *
 * This is the SAME collection that the RegulaOne platform writes to — both apps point
 * at the same MongoDB database, and tenants are created/managed in RegulaOne. SafeVoice
 * only needs to READ a couple of fields to answer one question: "is this a real, active
 * organisation that is allowed to receive reports?" So we map just those fields here and
 * let MongoDB ignore everything else on the document (packages, address, tax numbers...).
 *
 * The document id is a MongoDB ObjectId (a 24-character hex string such as
 * "6a34ca2d9d71d550dff0c3b6"). Spring maps it to/from this String id automatically.
 */
@Data
@Document(collection = "tenants")
public class Tenant {

    // The tenant id — the Mongo _id (ObjectId), exposed here as its hex string form.
    @Id
    private String id;

    // The organisation's legal name, kept for readable logs and admin screens.
    private String name;

    // Lifecycle state, stored as the RegulaOne TenantStatus name:
    // "ACTIVE", "INACTIVE", or "SUSPENDED". Only ACTIVE tenants may receive reports.
    private String status;
}
