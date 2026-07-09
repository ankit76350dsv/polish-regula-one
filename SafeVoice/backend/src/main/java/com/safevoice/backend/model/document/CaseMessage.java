package com.safevoice.backend.model.document;

import com.safevoice.backend.model.base.BaseDocument;
import com.safevoice.backend.model.embedded.EvidenceAttachment;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * MongoDB document representing chat logs within a case channel.
 * Indexed by caseId for quick message retrieval.
 * The backend no longer performs field encryption/decryption on message text; normal
 * whistleblower plaintext messages are blocked until client-side encrypted payload support lands.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "safevoice_case_messages")
public class CaseMessage extends BaseDocument {

    @Indexed
    private String caseId;

    private String sender; // e.g., Reporter, Compliance Officer, Investigator, HR Manager, System

    private String text;

    private Instant timestamp;

    private List<EvidenceAttachment> attachments = new ArrayList<>();

    private boolean readByReporter;

    private boolean readByAdmin;
}
