package com.regulaone.backend.services;

import com.regulaone.backend.dto.LoginResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class CognitoService {

    private final CognitoIdentityProviderClient cognitoClient;

    @Value("${aws.cognito.user-pool-id}")
    private String userPoolId;

    @Value("${aws.cognito.client-id}")
    private String clientId;

    @Value("${aws.cognito.client-secret:}")
    private String clientSecret;

    public CognitoService(@Value("${aws.cognito.region}") String region) {
        this.cognitoClient = CognitoIdentityProviderClient.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }

    // ── Public Auth ──────────────────────────────────────────────────────────

    public void signUp(String name, String email, String password) {
        try {
            SignUpRequest.Builder req = SignUpRequest.builder()
                    .clientId(clientId)
                    .username(email)
                    .password(password)
                    .userAttributes(
                            AttributeType.builder().name("email").value(email).build(),
                            AttributeType.builder().name("name").value(name).build()
                    );
            if (hasClientSecret()) req.secretHash(secretHash(email));
            cognitoClient.signUp(req.build());
        } catch (UsernameExistsException e) {
            throw new IllegalArgumentException("Email already registered");
        } catch (InvalidPasswordException e) {
            throw new IllegalArgumentException("Password does not meet requirements: " + e.getMessage());
        }
    }

    public void confirmSignUp(String email, String code) {
        try {
            ConfirmSignUpRequest.Builder req = ConfirmSignUpRequest.builder()
                    .clientId(clientId)
                    .username(email)
                    .confirmationCode(code);
            if (hasClientSecret()) req.secretHash(secretHash(email));
            cognitoClient.confirmSignUp(req.build());
        } catch (CodeMismatchException e) {
            throw new IllegalArgumentException("Invalid confirmation code");
        } catch (ExpiredCodeException e) {
            throw new IllegalArgumentException("Confirmation code has expired. Please request a new one.");
        } catch (UserNotFoundException e) {
            throw new IllegalArgumentException("User not found");
        }
    }

    public void resendConfirmationCode(String email) {
        try {
            ResendConfirmationCodeRequest.Builder req = ResendConfirmationCodeRequest.builder()
                    .clientId(clientId)
                    .username(email);
            if (hasClientSecret()) req.secretHash(secretHash(email));
            cognitoClient.resendConfirmationCode(req.build());
        } catch (UserNotFoundException e) {
            throw new IllegalArgumentException("User not found");
        }
    }

    //! login
    public LoginResponse signIn(String email, String password) {
        try {
            Map<String, String> params = new HashMap<>();
            params.put("USERNAME", email);
            params.put("PASSWORD", password);

            if (hasClientSecret()) params.put("SECRET_HASH", secretHash(email));

            //? Call Cognito Login API
            InitiateAuthResponse res = cognitoClient.initiateAuth(
                    InitiateAuthRequest.builder()
                            .authFlow(AuthFlowType.USER_PASSWORD_AUTH)
                            .clientId(clientId)
                            .authParameters(params)
                            .build()
            );

            // Cognito may require the user to set a new password (invited users)
            if (res.challengeName() != null) {
                return LoginResponse.builder()
                        .challengeName(res.challengeNameAsString())
                        .session(res.session())
                        .username(email)
                        .build();
            }

            return tokensToResponse(res.authenticationResult());
        } catch (NotAuthorizedException e) {
            throw new IllegalArgumentException("Invalid email or password");
        } catch (UserNotConfirmedException e) {
            throw new IllegalArgumentException("Email not confirmed. Please check your inbox.");
        } catch (UserNotFoundException e) {
            throw new IllegalArgumentException("Invalid email or password");
        }
    }

    /** Called when Cognito returns NEW_PASSWORD_REQUIRED challenge (invited users on first login). */
    public LoginResponse respondToNewPasswordChallenge(String username, String session, String newPassword) {
        try {
            Map<String, String> responses = new HashMap<>();
            responses.put("USERNAME", username);
            responses.put("NEW_PASSWORD", newPassword);
            if (hasClientSecret()) responses.put("SECRET_HASH", secretHash(username));

            RespondToAuthChallengeResponse res = cognitoClient.respondToAuthChallenge(
                    RespondToAuthChallengeRequest.builder()
                            .clientId(clientId)
                            .challengeName(ChallengeNameType.NEW_PASSWORD_REQUIRED)
                            .session(session)
                            .challengeResponses(responses)
                            .build()
            );
            return tokensToResponse(res.authenticationResult());
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to set new password: " + e.getMessage());
        }
    }

    /** Change password for an authenticated user using their Cognito Access Token. */
    public void changePassword(String accessToken, String oldPassword, String newPassword) {
        try {
            cognitoClient.changePassword(
                    ChangePasswordRequest.builder()
                            .accessToken(accessToken)
                            .previousPassword(oldPassword)
                            .proposedPassword(newPassword)
                            .build()
            );
        } catch (NotAuthorizedException e) {
            throw new IllegalArgumentException("Current password is incorrect");
        } catch (InvalidPasswordException e) {
            throw new IllegalArgumentException("New password does not meet requirements: " + e.getMessage());
        }
    }

    // ── Admin Operations ─────────────────────────────────────────────────────

    /** Creates a user and triggers Cognito to send a temporary-password invitation email. */
    public UserType adminCreateUser(String name, String email, String role) {
        try {
            AdminCreateUserResponse res = cognitoClient.adminCreateUser(
                    AdminCreateUserRequest.builder()
                            .userPoolId(userPoolId)
                            .username(email)
                            .userAttributes(
                                    AttributeType.builder().name("email").value(email).build(),
                                    AttributeType.builder().name("name").value(name).build(),
                                    AttributeType.builder().name("email_verified").value("true").build()
                            )
                            .desiredDeliveryMediums(DeliveryMediumType.EMAIL)
                            .build()
            );

            // Assign role group (best-effort — group must exist in the User Pool)
            try {
                cognitoClient.adminAddUserToGroup(
                        AdminAddUserToGroupRequest.builder()
                                .userPoolId(userPoolId)
                                .username(email)
                                .groupName(toGroupName(role))
                                .build()
                );
            } catch (ResourceNotFoundException ignored) {}

            return res.user();
        } catch (UsernameExistsException e) {
            throw new IllegalArgumentException("Email already registered");
        }
    }

    public void adminDeleteUser(String username) {
        try {
            cognitoClient.adminDeleteUser(
                    AdminDeleteUserRequest.builder()
                            .userPoolId(userPoolId)
                            .username(username)
                            .build()
            );
        } catch (UserNotFoundException e) {
            throw new IllegalArgumentException("User not found");
        }
    }

    public AdminGetUserResponse adminGetUser(String username) {
        try {
            return cognitoClient.adminGetUser(
                    AdminGetUserRequest.builder()
                            .userPoolId(userPoolId)
                            .username(username)
                            .build()
            );
        } catch (UserNotFoundException e) {
            throw new IllegalArgumentException("User not found");
        }
    }

    public void adminUpdateUserAttributes(String username, String name, String email) {
        List<AttributeType> attrs = new ArrayList<>();
        if (name != null) attrs.add(AttributeType.builder().name("name").value(name).build());
        if (email != null) attrs.add(AttributeType.builder().name("email").value(email).build());
        if (attrs.isEmpty()) return;

        cognitoClient.adminUpdateUserAttributes(
                AdminUpdateUserAttributesRequest.builder()
                        .userPoolId(userPoolId)
                        .username(username)
                        .userAttributes(attrs)
                        .build()
        );
    }

    public void adminUpdateUserRole(String username, String role) {
        // Remove all current group memberships, then add the new one
        cognitoClient.adminListGroupsForUser(
                AdminListGroupsForUserRequest.builder()
                        .userPoolId(userPoolId)
                        .username(username)
                        .build()
        ).groups().forEach(g ->
                cognitoClient.adminRemoveUserFromGroup(
                        AdminRemoveUserFromGroupRequest.builder()
                                .userPoolId(userPoolId)
                                .username(username)
                                .groupName(g.groupName())
                                .build()
                )
        );

        try {
            cognitoClient.adminAddUserToGroup(
                    AdminAddUserToGroupRequest.builder()
                            .userPoolId(userPoolId)
                            .username(username)
                            .groupName(toGroupName(role))
                            .build()
            );
        } catch (ResourceNotFoundException ignored) {}
    }

    public List<UserType> listUsers() {
        return cognitoClient.listUsers(
                ListUsersRequest.builder()
                        .userPoolId(userPoolId)
                        .build()
        ).users();
    }

    public List<String> getUserGroups(String username) {
        return cognitoClient.adminListGroupsForUser(
                AdminListGroupsForUserRequest.builder()
                        .userPoolId(userPoolId)
                        .username(username)
                        .build()
        ).groups().stream()
                .map(g -> g.groupName())
                .collect(java.util.stream.Collectors.toList());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private LoginResponse tokensToResponse(AuthenticationResultType r) {
        return LoginResponse.builder()
                .accessToken(r.accessToken())
                .idToken(r.idToken())
                .refreshToken(r.refreshToken())
                .expiresIn(r.expiresIn())
                .tokenType(r.tokenType())
                .build();
    }

    private String toGroupName(String role) {
        if (role == null) return "ROLE_USER";
        String upper = role.toUpperCase();
        return upper.startsWith("ROLE_") ? upper : "ROLE_" + upper;
    }

    private boolean hasClientSecret() {
        return clientSecret != null && !clientSecret.isBlank();
    }

    private String secretHash(String username) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(clientSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            mac.update(username.getBytes(StandardCharsets.UTF_8));
            mac.update(clientId.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(mac.doFinal());
        } catch (Exception e) {
            throw new RuntimeException("Failed to compute Cognito secret hash", e);
        }
    }
}
