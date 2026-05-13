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
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final CognitoService cognitoService;
    private final UserRepository userRepository;

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

    public void changePassword(ChangePasswordRequest request, String accessToken) {
        cognitoService.changePassword(
                accessToken, request.getCurrentPassword(), request.getNewPassword());
    }

    public UserResponse getCurrentUser(String cognitoSub) {
        User user = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
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
