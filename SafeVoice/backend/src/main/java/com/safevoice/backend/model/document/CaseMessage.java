package com.safevoice.backend.model.document;

import com.safevoice.backend.model.annotation.Encrypted;
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
 * Employs encryption on the message body (text).
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "safevoice_case_messages")
public class CaseMessage extends BaseDocument {

    @Indexed
    private String caseId;

    private String sender; // e.g., Reporter, Compliance Officer, Investigator, HR Manager, System

    @Encrypted
    private String text;

    private Instant timestamp;

    private List<EvidenceAttachment> attachments = new ArrayList<>();

    private boolean readByReporter;

    private boolean readByAdmin;
}
