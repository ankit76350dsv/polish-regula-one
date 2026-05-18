package com.regulaone.backend.services;

import com.regulaone.backend.dto.*;
import com.regulaone.backend.dto.Auth.ChangePasswordRequest;
import com.regulaone.backend.dto.Auth.ConfirmSignupRequest;
import com.regulaone.backend.dto.Auth.InviteUserRequest;
import com.regulaone.backend.dto.Auth.LoginRequest;
import com.regulaone.backend.dto.Auth.LoginResponse;
import com.regulaone.backend.dto.Auth.RespondChallengeRequest;
import com.regulaone.backend.dto.Auth.SignupRequest;
import com.regulaone.backend.dto.Auth.UpdateUserRequest;
import com.regulaone.backend.dto.Auth.UserResponse;
import com.regulaone.backend.dto.Tenant.TenantRequest;
import com.regulaone.backend.dto.Tenant.TenantResponse;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.TenantRepository;
import com.regulaone.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminGetUserResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final CognitoService cognitoService;
    private final UserRepository userRepository;
    // Added: needed to create and link the tenant during admin org setup
    private final TenantService tenantService;
    private final TenantRepository tenantRepository;

    //! --- Public Auth ---
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
                    // ROLE_USER is reserved for members invited by an admin via the Team Management page.
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
    // Passing the email produced a SECRET_HASH mismatch → Cognito NotAuthorizedException
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

    // Added: called by POST /api/admin/org/setup on the admin's first login.
    // Creates the tenant organisation and links it to the authenticated admin user.
    // After this call the /me response will have tenantStatus == "ACTIVE", letting
    // the frontend drop the setup modal and show the dashboard.
    public UserResponse setupOrganisation(String cognitoSub, TenantRequest request) {
        User user = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Guard: prevent double-setup if the admin already has an organisation
        if (user.getTenant() != null) {
            throw new IllegalStateException("Organisation is already set up for this account");
        }

        // Delegate creation to TenantService so NIP/email uniqueness rules are enforced
        TenantResponse created = tenantService.createTenant(request);

        // Fetch the persisted Tenant entity so @DBRef stores a valid document reference
        Tenant tenant = tenantRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Tenant creation failed unexpectedly"));

        user.setTenant(tenant);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        return UserResponse.from(user);
    }

    // --- Admin ---

    //! invite
    public UserResponse inviteUser(InviteUserRequest request) {
        UserType cognitoUser = cognitoService.adminCreateUser(request.getName(), request.getEmail(), request.getRole());

        Map<String, String> attrs = cognitoUser.attributes().stream()
                .collect(Collectors.toMap(AttributeType::name, AttributeType::value));

        Role role = parseRole(request.getRole());

        User user = User.builder()
                .cognitoSub(attrs.get("sub"))
                .name(attrs.getOrDefault("name", request.getName()))
                .email(attrs.getOrDefault("email", request.getEmail()))
                .role(role)
                .enabled(true)
                .build();
        userRepository.save(user);

        return UserResponse.from(user);
    }

    //! list all users
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(UserResponse::from)
                .collect(Collectors.toList());
    }


    //! Update
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

    //! delete
    public void deleteUser(String username) {
        cognitoService.adminDeleteUser(username);
        userRepository.findByCognitoSub(username).ifPresent(userRepository::delete);
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
