package com.regulaone.backend.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.regulaone.backend.dto.Auth.LoginResponse;

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

   //! /** Change password for an authenticated user using their Cognito Access Token. */
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

    //! delete user
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

    /**
     * Delete a Cognito user but TOLERATE the case where they no longer exist there.
     *
     * Cognito's username is the user's email (that is what adminCreateUser uses). When we
     * remove a user we still want to clean up our own database even if Cognito has already
     * lost the account (e.g. it was deleted directly in AWS, or was never provisioned).
     * So instead of throwing on "not found", we just report whether a delete happened.
     *
     * @param username the Cognito username (the user's email)
     * @return true if a Cognito user was deleted, false if there was nothing to delete
     */
    public boolean adminDeleteUserIfExists(String username) {
        try {
            cognitoClient.adminDeleteUser(
                    AdminDeleteUserRequest.builder()
                            .userPoolId(userPoolId)
                            .username(username)
                            .build()
            );
            return true;
        } catch (UserNotFoundException e) {
            return false;
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

    //! update user info
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


    // Added: exchanges an unexpired Cognito refresh token for fresh idToken + accessToken.
    // Called by AuthController.refresh() when the short-lived tokens have expired (after 1 hour).
    // Cognito does NOT return a new refreshToken in the response — the existing one stays valid.
    // The username (email) is required to compute the SECRET_HASH when a client secret is configured.
    public LoginResponse refreshToken(String refreshTokenValue, String username) {
        try {
            Map<String, String> params = new HashMap<>();
            params.put("REFRESH_TOKEN", refreshTokenValue);
            if (hasClientSecret()) params.put("SECRET_HASH", secretHash(username));

            InitiateAuthResponse res = cognitoClient.initiateAuth(
                    InitiateAuthRequest.builder()
                            .authFlow(AuthFlowType.REFRESH_TOKEN_AUTH)
                            .clientId(clientId)
                            .authParameters(params)
                            .build()
            );

            AuthenticationResultType result = res.authenticationResult();
            // refreshToken is intentionally omitted here — Cognito does not rotate it on refresh
            return LoginResponse.builder()
                    .idToken(result.idToken())
                    .accessToken(result.accessToken())
                    .expiresIn(result.expiresIn())
                    .tokenType(result.tokenType())
                    .build();
        } catch (NotAuthorizedException e) {
            throw new IllegalArgumentException("Refresh token expired or invalid. Please log in again.");
        }
    }

    //! ── Helpers ──────────────────────────────────────────────────────────────
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
