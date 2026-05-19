package com.regulaone.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String cognitoSub;

    private String name;

    @Indexed(unique = true)
    private String email;

    private String password;

    @Builder.Default
    private Role role = Role.ROLE_USER;

    @Builder.Default
    private boolean enabled = true;


    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;


    // Added: reference to the Tenant (organisation) this user belongs to.
    // Null for ROLE_ADMIN until they complete the "Setup Organisation" flow on first login.
    // Null for ROLE_USER until an admin creates the org and links/invites them.
    // Frontend reads tenantId/tenantStatus from /me to decide which modal to show.
    @DBRef
    private Tenant tenant;

    // Added: list of compliance modules this user is allowed to access.
    // Populated from the package's appIds during org setup (admin) or from the
    // invite request during user invitation. Frontend uses this to control
    // sidebar visibility — if a module is absent here the menu item is hidden.
    @Builder.Default
    private List<TenantModule> moduleIds = new ArrayList<>();
}
