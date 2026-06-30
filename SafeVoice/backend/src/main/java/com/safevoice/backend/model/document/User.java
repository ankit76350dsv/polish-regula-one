package com.safevoice.backend.model.document;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

/**
 * Read-only view of a platform user in the SHARED "users" collection.
 *
 * This is the SAME collection RegulaOne owns and writes to — both apps point at the same
 * MongoDB database. SafeVoice never creates or edits users; it only READS a few fields to
 * authenticate a STAFF WebSocket connection: given the Cognito "sub" from the validated
 * SSO token, find which organisation (tenant) the user belongs to and which SafeVoice
 * permissions they hold. Everything else on the document is ignored.
 *
 * Why this is needed: a browser cannot send custom headers on a WebSocket handshake, so
 * the REST trick of trusting an "X-Tenant-ID" header does not work for sockets. Instead we
 * verify the user's identity from their token and look up the tenant here on the server,
 * so a client can never claim to belong to an organisation it does not.
 */
@Data
@Document(collection = "users")
public class User {

    @Id
    private String id;

    // The Cognito subject — the stable id in the JWT "sub" claim. We look users up by this.
    private String cognitoSub;

    private String email;

    private String name;

    // Whether the account is active. A disabled user is refused a WebSocket connection.
    private boolean enabled;

    // The organisation this user belongs to (a reference into the "tenants" collection).
    // We read its id to scope every socket subscription to that one tenant.
    @DBRef
    private Tenant tenant;

    // Cross-app permission codes (e.g. "SAFEVOICE_ADMIN"). SafeVoice reads the SAFEVOICE_*
    // ones; the rest are ignored. Never null so callers can iterate safely.
    private List<String> permissions = new ArrayList<>();
}
