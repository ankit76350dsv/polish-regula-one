package com.regulaone.backend.user;

import com.regulaone.backend.auth.CognitoService;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.User;
import com.regulaone.backend.tenant.TenantRepository;
import com.regulaone.backend.user.dto.TeamManagementStatsResponse;
import com.regulaone.backend.user.dto.UpdateProfileRequest;
import com.regulaone.backend.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * READING user accounts, and the one thing a person may change about themselves.
 *
 * WHY THIS CLASS IS THIS SMALL NOW
 *   It used to be a single class of nearly a thousand lines holding sign-in, password
 *   recovery, invitations, module grants, organisation setup and plan listing all at
 *   once — so almost every change to the platform had to touch it. That work now lives
 *   with the job it belongs to, and none of the behaviour changed in the move:
 *
 *     signing in, passwords, registration  →  {@link com.regulaone.backend.auth.AuthService}
 *     inviting / editing / removing users  →  {@link UserAdminService}
 *     creating and editing the company     →  {@link com.regulaone.backend.tenant.OrganisationService}
 *     listing the plans on sale            →  {@link com.regulaone.backend.billing.PackageService}
 *
 *   What is left is what the name says: looking users up, and letting a person edit
 *   their own profile.
 *
 * TENANT ISOLATION
 *   Every list method takes a company id and filters on it. Callers derive that id from
 *   the verified session token, never from the request body, so one organisation can
 *   never read another's members.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final CognitoService cognitoService;

    // ── One user ──────────────────────────────────────────────────────────────

    /** The signed-in person's own profile, found by the Cognito subject in their token. */
    public UserResponse getCurrentUser(String cognitoSub) {
        User user = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return UserResponse.from(user);
    }

    /**
     * Lets any authenticated user update their own display name.
     *
     * Only the name is editable: the e-mail is the Cognito identity key (changing it
     * needs admin tooling) and a role can never be self-assigned.
     *
     * Called by PATCH /api/auth/me.
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
     * Which company the signed-in person belongs to.
     *
     * Three endpoints need this one line before they can do anything (their own
     * organisation, their colleagues, their billing history), so it is named here rather
     * than being spelled out as getCurrentUser(...).getTenantId() in each controller.
     */
    public String currentTenantId(String cognitoSub) {
        return getCurrentUser(cognitoSub).getTenantId();
    }

    // ── Lists ─────────────────────────────────────────────────────────────────

    /**
     * Every user of ONE organisation, for the company-admin and platform-operator team
     * screens. The company must exist: an unknown id is an error rather than an empty
     * table, because an empty table would read as "this company has no staff".
     */
    public List<UserResponse> getAllUsers(String tenantId) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("Tenant not found"));

        return userRepository.findByTenant_Id(tenant.getId())
                .stream()
                .map(UserResponse::from)
                .collect(Collectors.toList());
    }

    /** Every user on the platform — the operator's own console only. */
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

    // ── Team management figures ───────────────────────────────────────────────

    /**
     * The header figures on ONE company's team screen: how many people there are, how
     * many are active, and how many paid seats are left.
     *
     * The people are counted in the database rather than loaded into memory, so no
     * personal data leaves MongoDB to produce four integers.
     */
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

    /**
     * The same header figures for the WHOLE platform, for the operator's console.
     *
     * Seat limits are deliberately absent here: seats are sold per company, so a
     * platform-wide "seats used" figure would be an invented total.
     */
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
}
