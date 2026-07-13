package com.safevoice.backend.model.document;

import com.safevoice.backend.model.base.BaseDocument;
import com.safevoice.backend.model.embedded.EncryptedPayload;
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
 *
 * ENCRYPTION MODEL: for every case (HR grievance threads included) the message text is locked
 * (encrypted) in the sender's browser and stored in {@link #encryptedText}; the server cannot
 * read the words. The plain {@link #text} field is used only for server-generated SYSTEM notices
 * (fixed, non-confidential boilerplate) and under the dev-only local-testing plaintext flag.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "safevoice_case_messages")
public class CaseMessage extends BaseDocument {

    @Indexed
    private String caseId;

    private String sender; //! in this store the user id not the permission stuff... e.g., Reporter, Compliance Officer, Investigator, HR Manager, System

    // Plain-text message. Used ONLY for server-generated SYSTEM notices (fixed boilerplate) and
    // under the dev-only local-testing plaintext flag. For real user messages this stays null.
    private String text;

    // The message text, locked (AES-256-GCM) in the sender's browser with a KMS-wrapped one-time
    // data key. The server stores it but cannot read it. Set for every real message, HR included.
    private EncryptedPayload encryptedText;

    private Instant timestamp;

    private List<EvidenceAttachment> attachments = new ArrayList<>();

    private boolean readByReporter;

    private boolean readByAdmin;
}
