package com.safevoice.backend.model.document;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

/**
 * Read-only view of a RegulaOne user in the shared "users" collection.
 * SafeVoice uses this only to resolve notification recipients for a tenant.
 */
@Data
@Document(collection = "users")
public class RegulaOneUser {

    @Id
    private String id;

    private String email;

    private boolean enabled = true;

    private Boolean emailNotification = true;

    @DBRef
    private Tenant tenant;

    private List<String> permissions = new ArrayList<>();

    public boolean emailNotificationsEnabled() {
        return emailNotification == null || emailNotification;
    }
}
