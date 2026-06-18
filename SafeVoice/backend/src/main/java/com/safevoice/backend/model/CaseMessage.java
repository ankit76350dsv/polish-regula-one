package com.safevoice.backend.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * MongoDB document representing chat logs within a case channel.
 * Indexed by caseId for quick message retrieval.
 * Employs encryption on the message body (text).
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "case_messages")
public class CaseMessage extends BaseDocument {

    @Indexed
    private UUID caseId;

    private String sender; // e.g., Reporter, Compliance Officer, Investigator, HR Manager, System

    @Encrypted
    private String text;

    private Instant timestamp;

    private List<EvidenceAttachment> attachments = new ArrayList<>();

    private boolean readByReporter;

    private boolean readByAdmin;
}
