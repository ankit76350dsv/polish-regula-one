package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.embedded.DsarTask;
import com.privacypilot.backend.model.enums.dsar.DsarStatus;
import com.privacypilot.backend.model.enums.dsar.DsarType;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A Data Subject Access Request ("DSAR") — when a person exercises one of their
 * GDPR rights (Arts. 15–22), such as asking for a copy of their data or asking
 * to delete it. The company must answer within one month (Art. 12(3)), which can
 * be extended by two more months for complex cases if the person is told in time.
 *
 * {@link #dueAt} is the deadline the app watches so a request is never missed.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_dsars")
public class Dsar extends BaseDocument {

    // Which right is being exercised (access, erasure, portability, ...).
    private DsarType type;

    // The name the requester gave.
    private String requesterName;

    // The requester's e-mail (used to verify identity and to reply).
    private String requesterEmail;

    // How the requester relates to the company (e.g. "Former employee").
    private String relation;

    // When the request was received. Starts the one-month clock.
    private Instant receivedAt;

    // The deadline to respond by (one month, or three if extended).
    private Instant dueAt;

    // True if the one-month deadline has been extended (Art. 12(3)).
    private boolean extended;

    // The reason the deadline was extended, and proof the person was informed.
    private String extensionReason;

    // In progress / completed / refused.
    private DsarStatus status;

    // When the request was completed. Null until it is finished.
    private Instant completedAt;

    // True once the requester's identity has been confirmed. Confirming identity
    // is required before handing over personal data (Art. 12(6)).
    private boolean identityVerified;

    // How the identity was confirmed, in plain words.
    private String identityMethod;

    // The to-do items for fulfilling this request.
    private List<DsarTask> tasks = new ArrayList<>();

    // Free-text working notes about the request.
    private String notes;
}
