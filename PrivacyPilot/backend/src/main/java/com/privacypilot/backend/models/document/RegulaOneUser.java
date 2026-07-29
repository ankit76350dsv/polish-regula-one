package com.privacypilot.backend.model.document;

import com.privacypilot.backend.security.PrivacyPilotPermission;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

/**
 * A user account in the SHARED "users" collection managed by RegulaOne. Identity
 * (name, e-mail, which company) comes from the RegulaOne platform via central
 * sign-on (OAuth2/OIDC), so PrivacyPilot does not invent its own passwords.
 *
 * On top of that shared identity, PrivacyPilot tracks WHAT the user may do here:
 *  - {@link #permissions} is the user's FULL, cross-app permission list (RBAC).
 *  - {@link #active} lets an admin switch access on/off inside PrivacyPilot.
 *
 * ONE user can hold MANY permissions at once — several PrivacyPilot codes AND
 * codes for other RegulaOne apps (KSEF_*, SAFEVOICE_*, ...). They all live in the
 * same flat list. Use the helper methods below to pull out just the PrivacyPilot
 * ones; codes for other apps are simply ignored here.
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

    // EVERY permission code the user holds, across ALL RegulaOne apps. RegulaOne
    // stores these as plain strings and stays app-agnostic; each app reads only
    // the codes it understands. Starts empty so it is never null.
    private List<String> permissions = new ArrayList<>();

    // Whether the user may currently use PrivacyPilot. False = access suspended.
    private boolean active = true;

    // The company this user belongs to (shared RegulaOne reference).
    @DBRef
    private Tenant tenant;

    /**
     * Just this user's PrivacyPilot permissions, with other apps' codes dropped.
     * Handy when we need to show or check all of the user's PrivacyPilot roles.
     */
    public List<PrivacyPilotPermission> privacyPilotPermissions() {
        return PrivacyPilotPermission.fromCodes(permissions);
    }

    /** True if the user holds the given PrivacyPilot permission. */
    public boolean hasPermission(PrivacyPilotPermission permission) {
        return permission != null && permissions != null
                && permissions.contains(permission.name());
    }

    /** True if the user holds AT LEAST ONE of the given PrivacyPilot permissions. */
    public boolean hasAnyPermission(PrivacyPilotPermission... allowed) {
        if (allowed != null) {
            for (PrivacyPilotPermission p : allowed) {
                if (hasPermission(p)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * The single PrivacyPilot code that best represents this user — the most
     * privileged one they hold — used for the "acting as" role in audit lines.
     * Null if the user has no PrivacyPilot permission at all.
     */
    public PrivacyPilotPermission primaryPrivacyPilotRole() {
        return PrivacyPilotPermission.primaryOf(permissions);
    }
}
