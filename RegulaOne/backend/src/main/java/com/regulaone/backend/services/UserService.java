package com.regulaone.backend.services;

import com.regulaone.backend.dto.*;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminGetUserResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final CognitoService cognitoService;
    private final UserRepository userRepository;

    // --- Public Auth ---
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
                    .role(Role.ROLE_USER)
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
        LoginResponse response = cognitoService.signIn(request.getEmail(), request.getPassword());

        // On successful login (no challenge), sync role from Cognito groups to MongoDB
        if (response.getIdToken() != null) {
            syncRoleToMongoDB(request.getEmail());
        }

        return response;
    }

    private void syncRoleToMongoDB(String email) {
        List<String> groups = cognitoService.getUserGroups(email);
        Role role = groups.contains("ROLE_ADMIN") ? Role.ROLE_ADMIN : Role.ROLE_USER;

        userRepository.findByEmail(email).ifPresent(user -> {
            user.setRole(role);
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
        });
    }

    public LoginResponse respondToChallenge(RespondChallengeRequest request) {
        return cognitoService.respondToNewPasswordChallenge(
                request.getUsername(), request.getSession(), request.getNewPassword()
        );
    }

    public void changePassword(ChangePasswordRequest request) {
        cognitoService.changePassword(
                request.getAccessToken(), request.getCurrentPassword(), request.getNewPassword()
        );
    }

    // --- Admin ---

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

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(UserResponse::from)
                .collect(Collectors.toList());
    }

    public UserResponse updateUser(String username, UpdateUserRequest request) {
        cognitoService.adminUpdateUserAttributes(username, request.getName(), request.getEmail());
        if (request.getRole() != null) {
            cognitoService.adminUpdateUserRole(username, request.getRole());
        }

        // Sync changes to MongoDB
        User user = userRepository.findByEmail(username)
                .orElseGet(() -> {
                    AdminGetUserResponse cognito = cognitoService.adminGetUser(username);
                    Map<String, String> a = cognito.userAttributes().stream()
                            .collect(Collectors.toMap(AttributeType::name, AttributeType::value));
                    return User.builder()
                            .cognitoSub(a.get("sub"))
                            .email(a.getOrDefault("email", username))
                            .name(a.getOrDefault("name", ""))
                            .role(Role.ROLE_USER)
                            .enabled(true)
                            .build();
                });

        if (request.getName() != null) user.setName(request.getName());
        if (request.getEmail() != null) user.setEmail(request.getEmail());
        if (request.getRole() != null) user.setRole(parseRole(request.getRole()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        return UserResponse.from(user);
    }

    public void deleteUser(String username) {
        cognitoService.adminDeleteUser(username);
        userRepository.findByEmail(username).ifPresent(userRepository::delete);
    }

    private Role parseRole(String roleStr) {
        if (roleStr == null) return Role.ROLE_USER;
        String normalized = roleStr.toUpperCase();
        if (!normalized.startsWith("ROLE_")) normalized = "ROLE_" + normalized;
        try {
            return Role.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            return Role.ROLE_USER;
        }
    }

}
