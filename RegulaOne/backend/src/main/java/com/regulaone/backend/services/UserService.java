package com.regulaone.backend.services;

import com.regulaone.backend.dto.*;
import com.regulaone.backend.dto.Admin.AdminPackageResponse;
import com.regulaone.backend.dto.Auth.ChangePasswordRequest;
import com.regulaone.backend.dto.Auth.ConfirmSignupRequest;
import com.regulaone.backend.dto.Auth.InviteUserRequest;
import com.regulaone.backend.dto.Auth.LoginRequest;
import com.regulaone.backend.dto.Auth.LoginResponse;
import com.regulaone.backend.dto.Auth.RespondChallengeRequest;
import com.regulaone.backend.dto.Auth.SignupRequest;
import com.regulaone.backend.dto.Auth.UpdatePermissionsRequest;
import com.regulaone.backend.dto.Auth.UpdateProfileRequest;
import com.regulaone.backend.dto.Auth.UpdateModulesRequest;
import com.regulaone.backend.dto.Auth.UpdateUserRequest;
import com.regulaone.backend.dto.Auth.UpdateUserStatusRequest;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.dto.Tenant.TeamManagementStatsResponse;
import com.regulaone.backend.dto.Tenant.TenantRequest;
import com.regulaone.backend.dto.Tenant.TenantResponse;
import com.regulaone.backend.dto.Tenant.UpdateOrgRequest;
import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.PackageRepository;
import com.regulaone.backend.repository.TenantRepository;
import com.regulaone.backend.repository.UserRepository;
import com.regulaone.backend.utils.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminGetUserResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserType;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    // Permission codes that are PLATFORM-LEVEL: only the SaaS operator (ROLE_SUPER_ADMIN) may
    // grant or revoke them. A company admin (ROLE_ADMIN) edits the same user permission list, so
    // we must stop them changing these — e.g. KSEF_PLATFORM_ADMIN lets a user declare the GLOBAL
    // KSeF emergency/unavailability state for ALL tenants, which is never a tenant-level decision.
    private static final java.util.Set<String> PROTECTED_PERMISSIONS =
            java.util.Set.of("KSEF_PLATFORM_ADMIN");

    private final CognitoService cognitoService;
    private final UserRepository userRepository;
    // Added: needed to create and link the tenant during admin org setup
    private final TenantService tenantService;
    private final TenantRepository tenantRepository;
    private final PackageRepository appPackageRepository;
    // Added: generates a billing invoice whenever a plan is assigned to a tenant
    private final BillingService billingService;

    // ! --- Public Auth ---
    public MessageResponse signup(SignupRequest request) {
        cognitoService.signUp(request.getName(), request.getEmail(), request.getPassword());
        return new MessageResponse("Please check your email to verify your account.");
    }

    public MessageResponse confirmSignup(ConfirmSignupRequest request) {
        cognitoService.confirmSignUp(request.getEmail(), request.getCode());

        // Fetch the Cognito sub (UUID) after confirmation and save user to MongoDB
        if (!userRepository.existsByEmail(request.getEmail())) {
            AdminGetUserResponse cognitoUser = cognitoService.adminGetUser(request.getEmail());
            Map<String, String> attrs = cognitoUser.userAttributes().stream()
                    .collect(Collectors.toMap(AttributeType::name, AttributeType::value));

            User user = User.builder()
                    .cognitoSub(attrs.get("sub"))
                    .name(attrs.getOrDefault("name", ""))
                    .email(attrs.getOrDefault("email", request.getEmail()))
                    // Changed from ROLE_USER → ROLE_ADMIN.
                    // Self-registered users (via the signup form) are tenant admins by default.
                    // ROLE_USER is reserved for members invited by an admin via the Team Management
                    // page.
                    .role(Role.ROLE_ADMIN)
                    .enabled(true)
                    .build();
            userRepository.save(user);
        }

        return new MessageResponse("Account confirmed. You can now log in.");
    }

    public MessageResponse resendCode(String email) {
        cognitoService.resendConfirmationCode(email);
        return new MessageResponse("Confirmation code resent. Please check your email.");
    }

    public LoginResponse login(LoginRequest request) {
        Optional<User> user = userRepository.findByEmail(request.getEmail());

        if (user.isEmpty()) {
            throw new IllegalArgumentException(
                    "User not found in DB");
        }

        LoginResponse response = cognitoService.signIn(request.getEmail(), request.getPassword());

        return response;
    }

    public LoginResponse respondToChallenge(RespondChallengeRequest request) {
        return cognitoService.respondToNewPasswordChallenge(
                request.getUsername(), request.getSession(), request.getNewPassword());
    }

    // Added: exchanges an unexpired refresh token for new short-lived tokens.
    //
    // ROOT CAUSE OF PREVIOUS BUG:
    // The 'username' cookie stores the user's email (e.g. "user@company.pl").
    // However, this Cognito User Pool uses UUID sub values as the internal username
    // (email is only an alias). AWS requires the SECRET_HASH for REFRESH_TOKEN_AUTH
    // to be computed with the cognito:username (UUID), NOT the email alias.
    // Passing the email produced a SECRET_HASH mismatch → Cognito
    // NotAuthorizedException
    // → "Refresh token expired or invalid" even with a perfectly valid token.
    //
    // FIX: look up the user's cognitoSub by email and pass the sub to Cognito.
    public LoginResponse refreshTokens(String refreshToken, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Session expired. Please log in again."));
        return cognitoService.refreshToken(refreshToken, user.getCognitoSub());
    }

    public void changePassword(ChangePasswordRequest request, String accessToken) {
        cognitoService.changePassword(
                accessToken, request.getCurrentPassword(), request.getNewPassword());
    }

    public UserResponse getCurrentUser(String cognitoSub) {
        User user = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return UserResponse.from(user);
    }

    // Called during the admin's first-time organisation setup flow.
    // Creates a new tenant organisation, assigns the default subscription package,
    // and links the tenant to the authenticated admin user.
    //
    // Once setup is completed, the `/me` response will return:
    // tenantStatus == "ACTIVE"
    //
    // This allows the frontend to:
    // - close the organisation setup modal
    // - unlock platform access
    // - navigate the admin to the main dashboard
    // TODO: setup org
    @Transactional
    public UserResponse setupOrganisation(String cognitoSub, TenantRequest request) {

        User currentAdminUser = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Guard: prevent double-setup if the admin already has an organisation
        if (currentAdminUser.getTenant() != null) {
            throw new IllegalStateException("Organisation is already set up for this account");
        }

        // Todo: 1st write: Create tenant
        TenantResponse created = tenantService.createTenant(request);

        // Fetch tenant entity
        Tenant tenantAfterCreation = tenantRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Tenant creation failed unexpectedly"));

        // Fetch default package
        AppPackage basicPackage = appPackageRepository
                .findById("6a0466e9361d1caa88cba7ed")
                .orElseThrow(() -> new IllegalStateException("Default package not found"));

        // Ensure package is active
        if (basicPackage.getStatus() != PackageStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Cannot setup organisation because the default package is inactive");
        }

        LocalDateTime now = LocalDateTime.now();

        // 1 month subscription
        LocalDateTime expiryDate = now.plusDays(basicPackage.getDuration());

        // Set current package
        Tenant.PackageDetails packageDetails = Tenant.PackageDetails.builder()
                .appPackage(basicPackage)
                .planStarted(now)
                .planExpiring(expiryDate)
                .usersCapacity(String.valueOf(basicPackage.getUsersCapacity()))
                .build();

        tenantAfterCreation.setCurrentPackage(packageDetails);

        // Add package history
        Tenant.PackageHistory history = Tenant.PackageHistory.builder()
                .appPackage(basicPackage)
                .planStarted(now)
                .planExpired(expiryDate)
                .usersCapacity(String.valueOf(basicPackage.getUsersCapacity()))
                .build();

        tenantAfterCreation.getPackageHistory().add(history);

        tenantAfterCreation.setUpdatedAt(now);

        // TODO: 2nd Save tenant
        tenantRepository.save(tenantAfterCreation);

        // Generate a FREE invoice for the default package assigned at org setup.
        // isFree=true so amount=0 and status=FREE — the default plan is no-charge.
        billingService.generateInvoice(tenantAfterCreation, basicPackage, true);

        // Link tenant to user
        currentAdminUser.setTenant(tenantAfterCreation);
        currentAdminUser.setUpdatedAt(now);

        // Assign the package's default module list to the admin user so the sidebar
        // reflects exactly what the purchased plan includes from day one.
        currentAdminUser.setModuleIds(basicPackage.getAppIds());

        // TODO: 3rd write save user with the tenant
        userRepository.save(currentAdminUser);

        return UserResponse.from(currentAdminUser);
    }

    // --- Admin ---

    // ! invite : latter make reinvite api....
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

        UserType cognitoUser = cognitoService.adminCreateUser(request.getName(), request.getEmail(), request.getRole());

        Map<String, String> attrs = cognitoUser.attributes().stream()
                .collect(Collectors.toMap(AttributeType::name, AttributeType::value));

        Role role = parseRole(request.getRole());

        // Module access: admin explicitly passes the moduleIds during invite.
        List<TenantModule> moduleIds = request.getModuleIds();

        // Cross-app permission codes the admin chose for this user (e.g. KSEF_AUDITOR).
        // Never null — fall back to an empty list so the builder default stays clean.
        List<String> permissions = request.getPermissions() != null
                ? request.getPermissions()
                : new ArrayList<>();

        // Link the invited user to the tenant so that their /me response
        // returns the correct tenantId and they are not shown the
        // "Organisation not found" modal on first login.
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

        userRepository.save(user);

        return UserResponse.from(user);
    }

    // ! list all users for tenant
    public List<UserResponse> getAllUsers(String tenantId) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("Tenant not found"));

        return userRepository.findByTenant_Id(tenant.getId())
                .stream()
                .map(UserResponse::from)
                .collect(Collectors.toList());
    }

    // ! list all users for superadmin
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(UserResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * List ALL users of one tenant. Each returned user carries its enabled modules and
     * permission codes, so a module app can show the whole team and highlight who has
     * access to that module.
     *
     * Tenant-scoped, so one organisation can never see another's users. A blank tenant
     * (a user with no organisation yet) simply yields an empty list rather than an error.
     *
     * @param tenantId the organisation whose users to list (required)
     */
    public List<UserResponse> getTenantUsers(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            return List.of();
        }
        return userRepository.findByTenant_Id(tenantId)
                .stream()
                .map(UserResponse::from)
                .collect(Collectors.toList());
    }

    // ! team management dashboard stats
    public TeamManagementStatsResponse getTeamManagementStats(String tenantId) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("Tenant not found"));

        long totalMembers = userRepository.countByTenant_Id(tenantId);

        long activeMembers = userRepository.countByTenant_IdAndEnabledTrue(tenantId);

        long suspendedMembers = userRepository.countByTenant_IdAndEnabledFalse(tenantId);

        int tierLimit = 0;

        if (tenant.getCurrentPackage() != null
                && tenant.getCurrentPackage().getUsersCapacity() != null) {

            tierLimit = Integer.parseInt(
                    tenant.getCurrentPackage().getUsersCapacity());
        }

        int remainingSeats = tierLimit - (int) totalMembers;

        String currentPlan = tenant.getCurrentPackage() != null
                && tenant.getCurrentPackage().getAppPackage() != null
                        ? tenant.getCurrentPackage().getAppPackage().getName()
                        : "No Plan";

        return TeamManagementStatsResponse.builder()
                .tenantName(tenant.getName())
                .totalMembers(totalMembers)
                .activeMembers(activeMembers)
                .suspendedMembers(suspendedMembers)
                .tierLimit(tierLimit)
                .seatUsage(totalMembers + " / " + tierLimit + " seats used")
                .remainingSeats(remainingSeats)
                .currentPlan(currentPlan)
                .build();
    }

    // ! team management superadmin

    public TeamManagementStatsResponse getTeamManagementStats() {

        long totalUsers = userRepository.count();

        long activeUsers = userRepository.countByEnabledTrue();

        long suspendedUsers = userRepository.countByEnabledFalse();

        long admins = userRepository.countByRole(Role.ROLE_ADMIN);

        return TeamManagementStatsResponse.builder()
                .totalMembers(totalUsers)
                .activeMembers(activeUsers)
                .suspendedMembers(suspendedUsers)
                .admins(admins)
                .build();
    }

    // ! update user module access
    // Replaces the user's entire moduleIds list with the one supplied by the admin.
    // Uses the MongoDB document id (not cognitoSub) for consistency with updateUserStatus.
    public UserResponse updateUserModules(String userId, UpdateModulesRequest request) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // OLD: no module update existed — module access was only set at invite time
        // NEW: allow admin to revise module access at any time from the Team panel
        user.setModuleIds(request.getModuleIds());
        user.setUpdatedAt(LocalDateTime.now());

        userRepository.save(user);

        return UserResponse.from(user);
    }

    // ! update user cross-app permissions
    // Replaces the user's entire permissions list with the one supplied by the admin.
    // Mirrors updateUserModules — same pattern, but for app permission codes such as
    // KSEF_TENANT_ADMIN / KSEF_AUDITOR. Uses the MongoDB document id (not cognitoSub).
    //
    // SECURITY: some codes are PLATFORM-LEVEL (see PROTECTED_PERMISSIONS). Only a ROLE_SUPER_ADMIN
    // may grant/revoke those. A company admin (ROLE_ADMIN) calls the same method, so here we make
    // sure a non-super-admin can neither add nor remove a protected code — we keep whatever the
    // user already had. This stops a tenant admin handing themselves platform powers.
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

    // True only when the current request is made by a platform operator (ROLE_SUPER_ADMIN).
    // Reads the role straight from the security context, so it works for any endpoint that
    // routes here (both /api/admin/** and /api/superadmin/**).
    private boolean callerIsSuperAdmin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()));
    }

    // ! enable / disable user
    public UserResponse updateUserStatus(
            String userId,
            UpdateUserStatusRequest request) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setEnabled(request.isEnabled());
        user.setUpdatedAt(LocalDateTime.now());

        userRepository.save(user);

        return UserResponse.from(user);
    }

    

    // ! Update
    public UserResponse updateUser(String subId, UpdateUserRequest request) {

        User user = userRepository.findByCognitoSub(subId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

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

        if (request.getRole() != null) {
            user.setRole(Role.valueOf(request.getRole()));
        }

        user.setUpdatedAt(LocalDateTime.now());

        userRepository.save(user);

        return UserResponse.from(user);
    }

    /**
     * Lets any authenticated user update their own display name.
     * Only name is editable — email is the Cognito identity key (changing it
     * requires admin tooling) and role cannot be self-assigned.
     *
     * Called by PATCH /api/auth/me via AuthController.
     */
    public UserResponse updateCurrentUserProfile(String cognitoSub, UpdateProfileRequest request) {
        User user = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (request.getName() != null && !request.getName().isBlank()) {
            // Sync the new name to Cognito so the display name stays consistent
            cognitoService.adminUpdateUserAttributes(user.getEmail(), request.getName(), null);
            user.setName(request.getName());
        }

        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        return UserResponse.from(user);
    }

    /**
     * Lets ROLE_ADMIN update their own organisation's contact/address details.
     * Uses the admin's cognitoSub to locate their tenant record.
     *
     * Intentionally excludes nip, regon, and status — those require superadmin action.
     * All fields are optional (null = leave unchanged).
     *
     * Called by PUT /api/admin/org via AdminController.
     */
    public TenantResponse updateMyOrg(String cognitoSub, UpdateOrgRequest request) {
        User user = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // User stores a @DBRef to the full Tenant object, not a raw tenantId field.
        if (user.getTenant() == null) {
            throw new IllegalStateException("No organisation linked to this account");
        }

        Tenant tenant = tenantRepository.findById(user.getTenant().getId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Organisation not found with id: " + user.getTenant().getId()));

        // Apply only the fields supplied in the request; null fields are left unchanged
        if (request.getName() != null)       tenant.setName(request.getName());
        if (request.getEmail() != null)      tenant.setEmail(request.getEmail());
        if (request.getPhone() != null)      tenant.setPhone(request.getPhone());
        if (request.getAddress() != null)    tenant.setAddress(request.getAddress());
        if (request.getCity() != null)       tenant.setCity(request.getCity());
        if (request.getPostalCode() != null) tenant.setPostalCode(request.getPostalCode());
        tenant.setUpdatedAt(LocalDateTime.now());

        return TenantResponse.from(tenantRepository.save(tenant));
    }

    // Returns all ACTIVE packages sorted by price ascending.
    // Used by GET /api/admin/packages so ROLE_ADMIN can compare plan tiers on the My Plan page.
    public List<AdminPackageResponse> getActivePackages() {
        return appPackageRepository.findAll().stream()
                .filter(p -> p.getStatus() == PackageStatus.ACTIVE)
                .sorted(Comparator.comparing(AppPackage::getPrice))
                .map(AdminPackageResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * Permanently delete a user from BOTH our database and Cognito.
     *
     * The {@code identifier} may be the user's database id, their Cognito sub, or their
     * email — we resolve whichever it is, so every caller (team management, module apps,
     * the admin console) works without caring which key it holds.
     *
     * Rules and edge cases handled:
     *  - Blank identifier → rejected (400).
     *  - No matching user → 404 (we never pretend a delete happened).
     *  - The organisation's PRIMARY CONTACT (the user whose email equals their tenant's
     *    email) can NEVER be deleted — that account owns the organisation. Blocked (400).
     *  - Cognito is removed using the email (Cognito's username). If the Cognito account
     *    is already gone we still clean up our database, so no orphan record is left.
     *  - A user with no email/Cognito link (edge data) is still removed from our database.
     *
     * @param identifier the user's id, Cognito sub, or email
     */
    public void deleteUser(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("A user identifier is required to delete a user");
        }

        // Resolve the user by whichever key we were given.
        User user = userRepository.findById(identifier)
                .or(() -> userRepository.findByCognitoSub(identifier))
                .or(() -> userRepository.findByEmail(identifier))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Protect the organisation's primary-contact account: the user whose email matches
        // the tenant's contact email is the owner and must not be removable here.
        Tenant tenant = user.getTenant();
        if (tenant != null
                && tenant.getEmail() != null
                && user.getEmail() != null
                && tenant.getEmail().equalsIgnoreCase(user.getEmail())) {
            throw new IllegalStateException(
                    "This account is the organisation's primary contact and cannot be deleted.");
        }

        // Remove from Cognito by email (its username), tolerating an already-removed account
        // so our database is always cleaned up.
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            cognitoService.adminDeleteUserIfExists(user.getEmail());
        }

        // Remove from our database.
        userRepository.delete(user);
    }

    private Role parseRole(String roleStr) {
        if (roleStr == null)
            return Role.ROLE_USER;
        String normalized = roleStr.toUpperCase();
        if (!normalized.startsWith("ROLE_"))
            normalized = "ROLE_" + normalized;
        try {
            return Role.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            return Role.ROLE_USER;
        }
    }

}
