package com.privacypilot.backend.model.base;

import lombok.Data;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;

/**
 * Base class every PrivacyPilot database record extends.
 *
 * It gives each record the fields the compliance rules always require, so we
 * never forget them on a new entity:
 *  - a unique id (the primary key)
 *  - the tenantId, so one company can NEVER see another company's data
 *  - who created/changed it and when (filled automatically by Spring auditing)
 *  - soft-delete fields, so "deleting" only hides a record and keeps it for the
 *    10-year legal retention instead of erasing evidence.
 *
 * This mirrors the same base document used by the SafeVoice module so all
 * RegulaOne services store records the same way.
 */
@Data
public abstract class BaseDocument {

    // The unique id of this record (the primary key). Filled in by MongoDB.
    @Id
    private String id;

    // The company (tenant) this record belongs to. Indexed because EVERY query
    // filters by it to keep tenants completely separated from each other.
    @Indexed
    private String tenantId;

    // When the record was first created. Set automatically, never by hand.
    @CreatedDate
    private Instant createdAt;

    // When the record was last changed. Set automatically on every save.
    @LastModifiedDate
    private Instant updatedAt;

    // When the record was soft-deleted (hidden). Null while the record is live.
    private Instant deletedAt;

    // Soft-delete flag. True means "hidden from the app but kept for the legal
    // retention period". We never physically remove compliance records.
    private boolean deleted = false;

    // The id of the user who created the record. Set automatically.
    @CreatedBy
    private String createdBy;

    // The id of the user who last changed the record. Set automatically.
    @LastModifiedBy
    private String updatedBy;
}
