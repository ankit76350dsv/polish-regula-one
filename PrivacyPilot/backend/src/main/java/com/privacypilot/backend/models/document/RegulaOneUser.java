package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.enums.user.PrivacyRole;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A user account in the SHARED "users" collection managed by RegulaOne. Identity
 * (name, e-mail, which company) comes from the RegulaOne platform via central
 * sign-on (OAuth2/OIDC), so PrivacyPilot does not invent its own passwords.
 *
 * On top of that shared identity, PrivacyPilot tracks WHAT the user may do here:
 *  - {@link #role} decides the user's PrivacyPilot permissions (RBAC).
 *  - {@link #active} lets an admin switch access on/off inside PrivacyPilot.
 * The role name is also used in the audit trail so every action shows who did it
 * and in what capacity.
 */
@Data
@Document(collection = "users")
public class RegulaOneUser {

    // The user id — the Mongo _id, exposed as its hex string form.
    @Id
    private String id;

    // The user's display name, shown in lists and in the audit trail.
    private String name;

    // The user's e-mail address, also used as the login handle.
    private String email;

    // The user's PrivacyPilot role, which decides their permissions.
    private PrivacyRole role;

    // Whether the user may currently use PrivacyPilot. False = access suspended.
    private boolean active = true;

    // The company this user belongs to (shared RegulaOne reference).
    @DBRef
    private Tenant tenant;
}
