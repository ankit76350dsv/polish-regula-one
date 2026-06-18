package com.safevoice.backend.model.base;

import lombok.Data;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;

import java.time.Instant;
import java.util.UUID;

/**
 * Base document class that enforces system compliance guidelines:
 * - UUID primary key
 * - Spring Data Auditing (createdAt, updatedAt, createdBy, updatedBy)
 * - Soft delete support (deleted, deletedAt)
 */
@Data
public abstract class BaseDocument {

    @Id
    private UUID id = UUID.randomUUID();

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
