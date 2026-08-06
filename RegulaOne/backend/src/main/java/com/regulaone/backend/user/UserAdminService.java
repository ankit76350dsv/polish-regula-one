package com.regulaone.backend.user;

import com.regulaone.backend.auth.CognitoService;
import com.regulaone.backend.common.ResourceNotFoundException;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.User;
import com.regulaone.backend.tenant.TenantRepository;
import com.regulaone.backend.common.audit.AuditLogService;
import com.regulaone.backend.user.dto.InviteUserRequest;
import com.regulaone.backend.user.dto.UpdateEmailNotificationRequest;
import com.regulaone.backend.user.dto.UpdateModulesRequest;
import com.regulaone.backend.user.dto.UpdatePermissionsRequest;
import com.regulaone.backend.user.dto.UpdateRoleRequest;
import com.regulaone.backend.user.dto.UpdateUserRequest;
import com.regulaone.backend.user.dto.UpdateUserStatusRequest;
import com.regulaone.backend.user.dto.UserResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserType;

/**
 * CHANGING user accounts: inviting people, editing them, granting access, suspending
 * and deleting them.
 *
 * It is the write half of the user domain; {@link UserService} is the read half. They
 * were split out of one very large class so that "who may see the team list" and "who
 * may take somebody's access away" are no longer the same file.
 *
 * ── THE FOUR SAFETY RULES EVERY WRITE HERE OBEYS ────────────────────────────────
 *
 *   1. SAME COMPANY ONLY. A company administrator may only touch users inside their own
 *      organisation. Only the platform operator (ROLE_SUPER_ADMIN) is exempt.
 *
 *   2. THE OWNER IS UNTOUCHABLE. The account whose e-mail matches the organisation's own
 *      e-mail is the primary contact. It can be neither suspended nor deleted — losing
 *      it would leave the organisation with no owner.
 *
 *   3. NEVER THE LAST ADMIN, AND NEVER YOURSELF. Disabling or deleting the last enabled
 *      administrator would make a company unmanageable, and letting an administrator
 *      lock themselves out is simply a foot-gun.
 *
 *   4. PLATFORM POWERS ARE NOT SELF-SERVICE. Some permission codes are platform-level
 *      (see {@link #PROTECTED_PERMISSIONS}); a company administrator can neither grant
 *      nor revoke them, even though they use the same endpoint shape.
 *
 * WHY SOME METHODS COME IN PAIRS
 *   Two audiences reach these operations: a company administrator, whose identity is
 *   checked against the target user (rules 1–3), and the platform operator, who is
 *   already outside any single company. Rather than duplicating the whole method body,
 *   each pair delegates to one private implementation that takes the acting user — or
 *   null when there is none to check against.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserAdminService {

    /**
     * Permission codes that are PLATFORM-LEVEL: only the SaaS operator (ROLE_SUPER_ADMIN)
     * may grant or revoke them. A company admin (ROLE_ADMIN) edits the same user
     * permission list, so we must stop them changing these — e.g. KSEF_PLATFORM_ADMIN
     * lets a user declare the GLOBAL KSeF emergency/unavailability state for ALL tenants,
     * which is never a tenant-level decision.
     */
    private static final Set<String> PROTECTED_PERMISSIONS = Set.of("KSEF_PLATFORM_ADMIN");

    /**
     * The only roles a COMPANY administrator may hand out. ROLE_SUPER_ADMIN is missing on
     * purpose — it belongs to the platform operator, and nothing under /api/admin may
     * grant it.
     */
    private static final Set<String> ASSIGNABLE_ROLES =
            Set.of(Role.ROLE_ADMIN.name(), Role.ROLE_USER.name());

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final CognitoService cognitoService;
    private final SafeWorkEmployeeProvisioningService safeWorkEmployeeProvisioningService;
    // A role change is a privilege change, so it is recorded in the audit trail.
    private final AuditLogService auditLogService;

    // ── Invite ────────────────────────────────────────────────────────────────

    /**
     * Add a colleague to an organisation.
     *
     * Creates the Cognito account (which e-mails them a temporary password), stores the
     * matching RegulaOne user, and creates their SafeWork employee record so they exist
     * in the safety module from day one.
     *
     * Seat limit is enforced BEFORE the Cognito account is created, so a company that is
     * out of seats never ends up with an account it cannot use.
     */
    public UserResponse inviteUser(InviteUserRequest request) {

        Tenant tenant = tenantRepository.findById(request.getTenantId())
                .orElseThrow(() -> new RuntimeException("Tenant not found"));

        // Guard: tenant must have an active package with a defined usersCapacity before
        // inviting users. Integer.parseInt(null) would throw a cryptic NumberFormatException
        // otherwise, so we surface a clear error message instead.
        if (tenant.getCurrentPackage() == null
                || tenant.getCurrentPackage().getUsersCapacity() == null) {
            throw new RuntimeException(
                    "No package assigned to this organisation. Please assign a package before inviting users.");
        }

        int usersCapacity = Integer.parseInt(tenant.getCurrentPackage().getUsersCapacity());

        long currentUsers = userRepository.countByTenant_Id(tenant.getId());

        if (currentUsers >= usersCapacity) {
            throw new RuntimeException(
                    "User capacity exceeded. To add more users, please request a higher user quota or upgrade the package.");
        }

        // The role is checked FIRST, before anything is created: an invite naming a role
        // this administrator may not grant must be refused while it is still free to
        // refuse, not after a Cognito account exists and would have to be cleaned up.
        //
        // This whitelist closes an escalation: the previous parseRole() accepted ANY value
        // in the Role enum and quietly fell back to ROLE_USER only for unknown text — so
        // an invite carrying "SUPER_ADMIN" created a PLATFORM OPERATOR inside the caller's
        // own company.
        Role role = parseInvitedRole(request.getRole());

        UserType cognitoUser = cognitoService.adminCreateUser(
                request.getName(), request.getEmail(), role.name());

        Map<String, String> attrs = cognitoUser.attributes().stream()
                .collect(Collectors.toMap(AttributeType::name, AttributeType::value));

        // Module access: admin explicitly passes the moduleIds during invite.
        List<TenantModule> moduleIds = request.getModuleIds();

        // Cross-app permission codes the admin chose for this user (e.g. KSEF_AUDITOR).
        // Never null — fall back to an empty list so the builder default stays clean.
        List<String> permissions = request.getPermissions() != null
                ? request.getPermissions()
                : new ArrayList<>();

        // Link the invited user to the tenant so that their /me response returns the
        // correct tenantId and they are not shown the "Organisation not found" modal on
        // first login.
        User user = User.builder()
                .cognitoSub(attrs.get("sub"))
                .name(attrs.getOrDefault("name", request.getName()))
                .email(attrs.getOrDefault("email", request.getEmail()))
                .role(role)
                .enabled(true)
                .tenant(tenant)
                .moduleIds(moduleIds)
                .permissions(permissions)
                .build();

        User persistedUser = userRepository.save(user);
        safeWorkEmployeeProvisioningService.provision(persistedUser);

        return UserResponse.from(persistedUser);
    }

    // ── Access: modules and permissions ───────────────────────────────────────

    /**
     * Replace the user's whole module list with the one the admin supplied.
     *
     * Uses the MongoDB document id (not cognitoSub), consistent with the other
     * admin-side edits below.
     */
    public UserResponse updateUserModules(String userId, UpdateModulesRequest request) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setModuleIds(request.getModuleIds());
        user.setUpdatedAt(LocalDateTime.now());

        userRepository.save(user);

        return UserResponse.from(user);
    }

    /**
     * Replace the user's whole cross-app permission list (codes such as KSEF_ADMIN or
     * SAFEVOICE_AUDITOR).
     *
     * SECURITY — rule 4 above. A company admin and the platform operator call the SAME
     * method, so a non-super-admin must not be able to add or remove a platform-level
     * code. Their request keeps every ordinary code they chose, and any protected code
     * the user ALREADY had is carried over untouched. The blocked attempt is logged, so
     * an escalation attempt leaves a trace.
     */
    public UserResponse updateUserPermissions(String userId, UpdatePermissionsRequest request) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // What the caller asked us to save (null → empty so we never store null in MongoDB).
        List<String> requested = request.getPermissions() != null
                ? new ArrayList<>(request.getPermissions())
                : new ArrayList<>();

        // What the user currently has (used to protect platform-level codes from tenant admins).
        List<String> current = user.getPermissions() != null
                ? user.getPermissions()
                : new ArrayList<>();

        List<String> effective;
        if (callerIsSuperAdmin()) {
            // The platform operator may set anything, including the protected codes.
            effective = requested;
        } else {
            // Keep every NON-protected code the caller chose...
            effective = new ArrayList<>();
            for (String code : requested) {
                if (!PROTECTED_PERMISSIONS.contains(code)) {
                    effective.add(code);
                }
            }
            // ...then carry over any protected codes the user ALREADY had (caller can't remove them).
            for (String code : current) {
                if (PROTECTED_PERMISSIONS.contains(code) && !effective.contains(code)) {
                    effective.add(code);
                }
            }
            // Log any blocked attempt so it is visible in the audit/log trail.
            for (String code : PROTECTED_PERMISSIONS) {
                boolean wanted = requested.contains(code);
                boolean had = current.contains(code);
                if (wanted != had) {
                    log.warn("[updateUserPermissions] Non-super-admin attempt to {} protected permission [{}] "
                            + "on user [{}] was IGNORED", wanted ? "grant" : "revoke", code, userId);
                }
            }
        }

        user.setPermissions(effective);
        user.setUpdatedAt(LocalDateTime.now());

        userRepository.save(user);

        return UserResponse.from(user);
    }

    // ── Role (member ↔ administrator) ─────────────────────────────────────────

    /**
     * Change what a colleague may do: make them an administrator, or take that back.
     *
     * A role change is a PRIVILEGE change, so it is the most closely guarded write in this
     * class and the only one that is written to the audit trail (GDPR Art. 5(2)
     * accountability — a company must be able to show who was given control of its
     * compliance data, and when).
     *
     * THE FIVE RULES, and the reason each one exists:
     *
     *   1. ONLY ROLE_ADMIN AND ROLE_USER may be set. ROLE_SUPER_ADMIN is the platform
     *      operator's role; a company administrator granting it — to a colleague or to
     *      themselves — would be an escalation out of their own organisation entirely.
     *   2. SAME ORGANISATION ONLY (rule 1 of this class).
     *   3. NOT YOURSELF. An administrator demoting their own account would lock themselves
     *      out of the screen they are standing on, and promoting themselves is meaningless.
     *      Another administrator has to make the change.
     *   4. NOT THE ORGANISATION'S OWNER. The primary-contact account owns the organisation,
     *      so it stays an administrator — the same protection suspension and deletion have.
     *   5. NOT THE LAST ACTIVE ADMINISTRATOR. Demoting them would leave the company with
     *      nobody who can manage it.
     *
     * Authorisation is read from OUR database on every request (see CognitoJwtConverter),
     * so the new role takes effect on the person's next request — there is nothing to
     * change in the identity provider.
     *
     * @param userId          the member's id
     * @param actorCognitoSub the acting administrator, from their verified session token
     * @param request         the live HTTP request, used only to stamp the audit entry
     */
    @Transactional
    public UserResponse updateUserRole(String userId,
                                       UpdateRoleRequest updateRoleRequest,
                                       String actorCognitoSub,
                                       HttpServletRequest request) {

        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("A user id is required to update a role");
        }
        if (updateRoleRequest == null || updateRoleRequest.getRole() == null
                || updateRoleRequest.getRole().isBlank()) {
            throw new IllegalArgumentException("role is required");
        }

        // RULE 1 — an unknown or platform-level role is refused before anything is read.
        Role newRole = parseAssignableRole(updateRoleRequest.getRole());

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        User actor = requireActor(actorCognitoSub);
        assertSameOrganisation(actor, targetUser);          // RULE 2

        if (targetUser.getRole() == newRole) {
            // Nothing to do — do not touch updatedAt, and do not write an audit entry for
            // a change that did not happen.
            return UserResponse.from(targetUser);
        }

        applyRoleChange(actor, targetUser, newRole, request);

        targetUser.setUpdatedAt(LocalDateTime.now());
        userRepository.save(targetUser);

        return UserResponse.from(targetUser);
    }

    /**
     * Rules 3 to 5 of a role change, plus the audit entry — shared by BOTH endpoints that
     * can change a role, so neither can be the lenient one.
     *
     * Does nothing when the role is unchanged. The caller saves; this method only decides
     * whether the change is allowed, applies it to the object, and records it.
     */
    private void applyRoleChange(User actor, User targetUser, Role newRole, HttpServletRequest request) {
        Role previousRole = targetUser.getRole();
        if (previousRole == newRole) {
            return;
        }

        if (sameUser(actor, targetUser)) {                  // RULE 3
            throw new IllegalStateException("You cannot change your own role.");
        }

        // Rules 4 and 5 only bite when administrator rights are being TAKEN AWAY.
        if (previousRole == Role.ROLE_ADMIN && newRole != Role.ROLE_ADMIN) {
            if (isTenantPrimaryContact(targetUser)) {       // RULE 4
                throw new IllegalStateException(
                        "This account is the organisation's primary contact and must stay an administrator.");
            }
            if (targetUser.isEnabled()) {                   // RULE 5
                String tenantId = tenantIdOf(targetUser);
                if (tenantId != null) {
                    assertNotLastEnabledAdmin(tenantId,
                            "Cannot remove administrator rights from the last active admin in this organisation.");
                }
            }
        }

        targetUser.setRole(newRole);

        // The trail records WHO changed WHOSE role and in WHICH direction. The target is
        // named by id, not by e-mail, so the entry carries no more personal data than it
        // needs (GDPR Art. 5(1)(c)).
        auditLogService.record(
                tenantIdOf(actor),
                actor.getId(),
                actor.getEmail(),
                actor.getRole() != null ? actor.getRole().name() : null,
                "USER_ROLE_CHANGED",
                "USER",
                targetUser.getId(),
                List.of("from=" + previousRole.name(), "to=" + newRole.name()),
                request);

        log.info("[role] Admin [{}] changed user [{}] from {} to {}",
                actor.getId(), targetUser.getId(), previousRole, newRole);
    }

    /**
     * The role name as a value this endpoint is allowed to set.
     *
     * Anything outside the two company-level roles is refused — including ROLE_SUPER_ADMIN
     * and any future role — so adding a role to the enum can never silently become
     * grantable by a company administrator.
     */
    private Role parseAssignableRole(String roleName) {
        String normalised = roleName.trim().toUpperCase();
        if (!normalised.startsWith("ROLE_")) {
            normalised = "ROLE_" + normalised;
        }
        if (!ASSIGNABLE_ROLES.contains(normalised)) {
            throw new IllegalArgumentException(
                    "Role must be one of: " + String.join(", ", ASSIGNABLE_ROLES));
        }
        return Role.valueOf(normalised);
    }

    // ── Status (enable / suspend) ─────────────────────────────────────────────

    /**
     * Enable or suspend a user, on behalf of a named administrator.
     *
     * Used by the company-admin route, so all four safety rules apply: same company,
     * not the primary contact, not yourself, not the last active admin.
     *
     * @param actorCognitoSub the acting administrator's Cognito subject
     */
    @Transactional
    public UserResponse updateUserStatus(String userId,
                                         UpdateUserStatusRequest request,
                                         String actorCognitoSub) {
        return changeStatus(userId, request, actorCognitoSub, true);
    }

    /**
     * Enable or suspend a user with no acting administrator to check against.
     *
     * Used by the platform-operator route (and internal callers), where there is no
     * "same company" or "not yourself" rule to apply — the operator is outside every
     * company. The owner and last-admin protections still hold.
     */
    @Transactional
    public UserResponse updateUserStatus(String userId, UpdateUserStatusRequest request) {
        return changeStatus(userId, request, null, false);
    }

    /**
     * The one implementation behind both status methods.
     *
     * ORDER MATTERS and is deliberate: bad input first (400), then an unknown target
     * (404), then who is asking, then a no-op check, then the protective rules. Resolving
     * the actor before loading the target would answer "admin not found" for a request
     * that is really about a user who does not exist.
     */
    private UserResponse changeStatus(String userId,
                                      UpdateUserStatusRequest request,
                                      String actorCognitoSub,
                                      boolean checkActor) {

        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("A user id is required to update status");
        }
        if (request == null || request.getEnabled() == null) {
            throw new IllegalArgumentException("enabled is required");
        }

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        User actor = null;
        if (checkActor) {
            actor = requireActor(actorCognitoSub);
            assertSameOrganisation(actor, targetUser);
        }

        boolean desiredEnabled = request.getEnabled();
        if (targetUser.isEnabled() == desiredEnabled) {
            // Re-sending the current status is a no-op and must not touch updatedAt.
            return UserResponse.from(targetUser);
        }

        assertStatusChangeAllowed(actor, targetUser, desiredEnabled);

        targetUser.setEnabled(desiredEnabled);
        if (!desiredEnabled) {
            // A suspended account must not keep receiving compliance e-mails.
            targetUser.setEmailNotification(false);
        }
        targetUser.setUpdatedAt(LocalDateTime.now());

        userRepository.save(targetUser);

        return UserResponse.from(targetUser);
    }

    // ── E-mail notification preference ────────────────────────────────────────

    /** Turn a user's e-mail notifications on or off, on behalf of a named administrator. */
    @Transactional
    public UserResponse updateEmailNotification(String userId,
                                                UpdateEmailNotificationRequest request,
                                                String actorCognitoSub) {
        return changeEmailNotification(userId, request, actorCognitoSub, true);
    }

    /** The same, from the platform-operator route, where there is no acting company admin. */
    @Transactional
    public UserResponse updateEmailNotification(String userId,
                                                UpdateEmailNotificationRequest request) {
        return changeEmailNotification(userId, request, null, false);
    }

    /** The one implementation behind both e-mail-preference methods. Same order as above. */
    private UserResponse changeEmailNotification(String userId,
                                                 UpdateEmailNotificationRequest request,
                                                 String actorCognitoSub,
                                                 boolean checkActor) {

        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("A user id is required to update email notifications");
        }
        if (request == null || request.getEmailNotification() == null) {
            throw new IllegalArgumentException("emailNotification is required");
        }

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (checkActor) {
            User actor = requireActor(actorCognitoSub);
            assertSameOrganisation(actor, targetUser);
        }

        boolean emailNotification = request.getEmailNotification();

        if (emailNotification && !targetUser.isEnabled()) {
            throw new IllegalStateException("Email notifications cannot be enabled for a disabled user.");
        }
        if (emailNotificationEnabled(targetUser) == emailNotification) {
            return UserResponse.from(targetUser);
        }

        targetUser.setEmailNotification(emailNotification);
        targetUser.setUpdatedAt(LocalDateTime.now());
        userRepository.save(targetUser);

        return UserResponse.from(targetUser);
    }

    /** Missing means "on": notifications are the default for a new account. */
    private boolean emailNotificationEnabled(User user) {
        return user.getEmailNotification() == null || user.getEmailNotification();
    }

    // ── Edit and delete ───────────────────────────────────────────────────────

    /**
     * Edit a user's name, e-mail or role, found by their Cognito subject.
     *
     * Cognito is updated first, so our database never claims a name or address that the
     * identity provider rejected.
     */
    @Transactional
    public UserResponse updateUser(String subId,
                                   UpdateUserRequest request,
                                   String actorCognitoSub,
                                   HttpServletRequest httpRequest) {

        User user = userRepository.findByCognitoSub(subId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // WHY THESE TWO LINES EXIST (they were missing, and it mattered):
        // this endpoint takes a COGNITO SUBJECT from the URL and used to edit whoever it
        // belonged to — with no check that the person belonged to the caller's company.
        // A company administrator who learned a subject id could rename, re-address and
        // re-role a user in a DIFFERENT organisation. Every other write in this class was
        // already tenant-scoped; this one now is too.
        User actor = requireActor(actorCognitoSub);
        assertSameOrganisation(actor, user);                                  // RULE 1

        // A role change goes through exactly the same rules as PATCH /users/{id}/role:
        // only ROLE_ADMIN or ROLE_USER (never the platform-operator role), never your own,
        // never the organisation's owner, never the last active administrator — and it is
        // written to the audit trail. Before this, the line was
        // "user.setRole(Role.valueOf(request.getRole()))", which accepted ROLE_SUPER_ADMIN.
        if (request.getRole() != null && !request.getRole().isBlank()) {
            applyRoleChange(actor, user, parseAssignableRole(request.getRole()), httpRequest);
        }

        // Cognito is updated first, so our database never claims a name or address the
        // identity provider rejected.
        cognitoService.adminUpdateUserAttributes(
                user.getEmail(),
                request.getName(),
                request.getEmail());

        if (request.getName() != null) {
            user.setName(request.getName());
        }

        if (request.getEmail() != null) {
            user.setEmail(request.getEmail());
        }

        user.setUpdatedAt(LocalDateTime.now());

        userRepository.save(user);

        return UserResponse.from(user);
    }

    /**
     * Permanently delete a user from BOTH our database and Cognito.
     *
     * The {@code identifier} may be the user's database id, their Cognito sub, or their
     * e-mail — we resolve whichever it is, so every caller (team management, module apps,
     * the admin console) works without caring which key it holds.
     *
     * Rules and edge cases handled:
     *  - Blank identifier → rejected (400).
     *  - No matching user → 404 (we never pretend a delete happened).
     *  - Only inside the acting admin's own organisation, and never their own account.
     *  - The organisation's PRIMARY CONTACT can NEVER be deleted — that account owns the
     *    organisation.
     *  - Never the last enabled administrator, which would leave the company unmanageable.
     *  - Cognito is removed using the e-mail (Cognito's username). If that account is
     *    already gone we still clean up our database, so no orphan record is left behind.
     *
     * @param identifier      the user's id, Cognito sub, or e-mail
     * @param actorCognitoSub the authenticated administrator's Cognito subject
     */
    @Transactional
    public void deleteUser(String identifier, String actorCognitoSub) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("A user identifier is required to delete a user");
        }

        // Resolve the user by whichever key we were given.
        User user = userRepository.findById(identifier)
                .or(() -> userRepository.findByCognitoSub(identifier))
                .or(() -> userRepository.findByEmail(identifier))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        User actor = requireActor(actorCognitoSub);
        assertSameOrganisation(actor, user);

        if (sameUser(actor, user)) {
            throw new IllegalStateException("You cannot delete your own account.");
        }

        if (isTenantPrimaryContact(user)) {
            throw new IllegalStateException(
                    "This account is the organisation's primary contact and cannot be deleted.");
        }
        if (user.isEnabled() && user.getRole() == Role.ROLE_ADMIN) {
            // NOTE the asymmetry with the status rule below: deletion checks even when the
            // user has no organisation, suspension skips that case. Both are kept exactly
            // as they were, because deletion is the irreversible one and should stay the
            // stricter of the two. (Unreachable over HTTP today: this route is ROLE_ADMIN
            // only, and the same-organisation rule already ran above.)
            assertNotLastEnabledAdmin(tenantIdOf(user),
                    "Cannot delete the last active admin in this organisation.");
        }

        // Remove from Cognito by email (its username), tolerating an already-removed
        // account so our database is always cleaned up.
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            cognitoService.adminDeleteUserIfExists(user.getEmail());
        }

        // Remove from our database.
        userRepository.delete(user);
        log.info("[deleteUser] Admin [{}] deleted user [{}] from tenant [{}]",
                actor.getId(), user.getId(), tenantIdOf(user));
    }

    // ── The safety rules, in one place ────────────────────────────────────────

    /**
     * True only when the current request is made by a platform operator
     * (ROLE_SUPER_ADMIN). Read straight from the security context, so it works for any
     * endpoint that routes here (both /api/admin/** and /api/superadmin/**).
     */
    private boolean callerIsSuperAdmin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()));
    }

    /** The acting administrator's own record; they must exist to act. */
    private User requireActor(String actorCognitoSub) {
        if (actorCognitoSub == null || actorCognitoSub.isBlank()) {
            throw new IllegalStateException("Authenticated admin could not be resolved");
        }
        return userRepository.findByCognitoSub(actorCognitoSub)
                .orElseThrow(() -> new IllegalStateException("Authenticated admin account was not found"));
    }

    /** RULE 1 — a company admin may only act inside their own organisation. */
    private void assertSameOrganisation(User actor, User targetUser) {
        if (callerIsSuperAdmin()) {
            return;
        }

        String actorTenantId = tenantIdOf(actor);
        String targetTenantId = tenantIdOf(targetUser);
        if (actorTenantId == null || targetTenantId == null) {
            throw new IllegalStateException("Both admin and target user must belong to an organisation");
        }
        if (!actorTenantId.equals(targetTenantId)) {
            throw new IllegalStateException("Cannot update a user from another organisation");
        }
    }

    /** RULES 2 and 3, for a status change. */
    private void assertStatusChangeAllowed(User actor, User targetUser, boolean desiredEnabled) {
        if (isTenantPrimaryContact(targetUser)) {
            throw new IllegalStateException(
                    "This account is the organisation's primary contact and its status cannot be changed.");
        }

        if (actor != null && !desiredEnabled && sameUser(actor, targetUser)) {
            throw new IllegalStateException("You cannot disable your own account.");
        }

        if (!desiredEnabled && targetUser.getRole() == Role.ROLE_ADMIN) {
            String tenantId = tenantIdOf(targetUser);
            // A user who belongs to no organisation cannot be the last admin OF one, so
            // there is nothing to protect here.
            if (tenantId != null) {
                assertNotLastEnabledAdmin(tenantId,
                        "Cannot disable the last active admin in this organisation.");
            }
        }
    }

    /** RULE 3 — refuse when this user is the only enabled administrator their company has. */
    private void assertNotLastEnabledAdmin(String tenantId, String message) {
        long enabledAdminCount = userRepository.findByTenant_IdAndEnabledTrue(tenantId).stream()
                .filter(candidate -> candidate.getRole() == Role.ROLE_ADMIN)
                .count();
        if (enabledAdminCount <= 1) {
            throw new IllegalStateException(message);
        }
    }

    /** Two records for the same person, compared by id and then by Cognito subject. */
    private boolean sameUser(User left, User right) {
        if (left == null || right == null) {
            return false;
        }
        if (left.getId() != null && left.getId().equals(right.getId())) {
            return true;
        }
        return left.getCognitoSub() != null && left.getCognitoSub().equals(right.getCognitoSub());
    }

    private String tenantIdOf(User user) {
        if (user == null || user.getTenant() == null || user.getTenant().getId() == null
                || user.getTenant().getId().isBlank()) {
            return null;
        }
        return user.getTenant().getId();
    }

    /**
     * RULE 2 — is this the account that OWNS the organisation?
     *
     * The primary contact is the user whose e-mail equals the organisation's e-mail. The
     * organisation is re-read from the database when the reference on the user document
     * does not settle it, so a stale reference cannot make an owner look ordinary.
     */
    private boolean isTenantPrimaryContact(User user) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return false;
        }

        Tenant tenant = user.getTenant();
        if (tenant == null) {
            return false;
        }

        if (sameEmail(user.getEmail(), tenant.getEmail())) {
            return true;
        }

        String tenantId = tenant.getId();
        if (tenantId == null || tenantId.isBlank()) {
            return false;
        }

        return tenantRepository.findById(tenantId)
                .map(Tenant::getEmail)
                .filter(email -> sameEmail(user.getEmail(), email))
                .isPresent();
    }

    /** E-mail comparison the way people mean it: trimmed and case-insensitive. */
    private boolean sameEmail(String left, String right) {
        return left != null
                && right != null
                && !left.isBlank()
                && !right.isBlank()
                && left.trim().equalsIgnoreCase(right.trim());
    }

    /**
     * The role a new colleague is invited with.
     *
     * Nothing supplied means the least-privileged role. Anything else must be one of the
     * two roles a company administrator may grant — "admin", "ADMIN" and "ROLE_ADMIN" all
     * work, while ROLE_SUPER_ADMIN and unknown text are refused with a clear message
     * rather than being silently downgraded.
     */
    private Role parseInvitedRole(String roleStr) {
        if (roleStr == null || roleStr.isBlank()) {
            return Role.ROLE_USER;
        }
        return parseAssignableRole(roleStr);
    }
}
