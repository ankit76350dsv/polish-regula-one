package com.safevoice.backend.model;

import com.safevoice.backend.model.enums.EvidenceStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Embedded document representing whistleblower evidence attachments,
 * tracking sanitization and scan outcomes.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EvidenceAttachment {

    private UUID id = UUID.randomUUID();
    private String displayName;
    private String extension; // e.g. "PDF", "PNG", "JPG", "XML", "DOCX"
    private String sizeLabel;
    private EvidenceStatus status;
    private boolean metadataStripped;
    private boolean originalNameStored;
    private Instant uploadedAt;
    private String storageVaultRef;
}
