package com.safevoice.backend.model.base;

import lombok.Data;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;

/**
 * Base document class that enforces system compliance guidelines:
 * - UUID primary key
 * - Tenant isolation (tenantId)
 * - Spring Data Auditing (createdAt, updatedAt, createdBy, updatedBy)
 * - Soft delete support (deleted, deletedAt)
 */
@Data
public abstract class BaseDocument {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant deletedAt;

    private boolean deleted = false;

    @CreatedBy
    private String createdBy;

    @LastModifiedBy
    private String updatedBy;
}
