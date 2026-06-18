package com.safevoice.backend.model.document;

import com.safevoice.backend.model.annotation.Encrypted;
import com.safevoice.backend.model.base.BaseDocument;
import com.safevoice.backend.model.enums.AppRole;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * MongoDB document representing back-office personnel (admins, investigators).
 * Employs uniqueness on the email address, requires MFA, and encrypts PII (name, email).
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "users")
public class SaaSUser extends BaseDocument {

    @Encrypted
    private String name;

    @Indexed(unique = true)
    @Encrypted
    private String email;

    private AppRole role;

    private String status; // Active | Pending | Locked

    private Instant joinedDate;

    private boolean mfaRequired = true;

    private Instant lastLoginReview;
}
