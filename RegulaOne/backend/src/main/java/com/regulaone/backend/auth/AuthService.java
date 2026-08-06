package com.regulaone.backend.auth;

import com.regulaone.backend.auth.dto.ChangePasswordRequest;
import com.regulaone.backend.auth.dto.ConfirmSignupRequest;
import com.regulaone.backend.auth.dto.ForgotPasswordRequest;
import com.regulaone.backend.auth.dto.LoginRequest;
import com.regulaone.backend.auth.dto.LoginResponse;
import com.regulaone.backend.auth.dto.ResetPasswordRequest;
import com.regulaone.backend.auth.dto.RespondChallengeRequest;
import com.regulaone.backend.auth.dto.SignupRequest;
import com.regulaone.backend.common.MessageResponse;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.User;
import com.regulaone.backend.user.SafeWorkEmployeeProvisioningService;
import com.regulaone.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminGetUserResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;

import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Getting IN and OUT of the platform: registration, sign-in, token refresh and
 * passwords.
 *
 * WHY THIS SERVICE EXISTS SEPARATELY
 *   All of this used to sit inside UserService, together with team management, plan
 *   listing and organisation setup — one class of nearly a thousand lines that changed
 *   for four unrelated reasons. Signing in and managing a colleague's module access are
 *   not the same job, so they are no longer in the same class. Nothing about the
 *   behaviour of any endpoint changed in the move.
 *
 * WHERE THE PASSWORD ACTUALLY LIVES
 *   Nowhere in RegulaOne. Every credential operation is delegated to AWS Cognito
 *   through {@link CognitoService}; this service never sees a stored password hash and
 *   never writes one. Our own {@code users} collection holds only the profile and the
 *   Cognito "sub" that links the two.
 *
 * WHY REGISTRATION WRITES A USER RECORD HERE
 *   Confirming an e-mail address is the moment a person becomes real to the platform,
 *   so that is where their RegulaOne record is created. It is part of the sign-up flow,
 *   not of user administration, which is why it lives with the sign-up code.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final CognitoService cognitoService;
    private final UserRepository userRepository;
    private final SafeWorkEmployeeProvisioningService safeWorkEmployeeProvisioningService;

    // ── Registration ──────────────────────────────────────────────────────────

    public MessageResponse signup(SignupRequest request) {
        cognitoService.signUp(request.getName(), request.getEmail(), request.getPassword());
        return new MessageResponse("Please check your email to verify your account.");
    }

    /**
     * Finish sign-up: verify the e-mailed code, then create the person's RegulaOne
     * record if they do not already have one.
     *
     * The Cognito "sub" (a UUID) is fetched after confirmation and stored, because that
     * is the id every later request is identified by.
     */
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
                    // Self-registered users (via the signup form) are tenant admins by
                    // default. ROLE_USER is reserved for members invited by an admin
                    // from the Team Management page.
                    .role(Role.ROLE_ADMIN)
                    .enabled(true)
                    .build();
            User persistedUser = userRepository.save(user);
            safeWorkEmployeeProvisioningService.provision(persistedUser);
        }

        return new MessageResponse("Account confirmed. You can now log in.");
    }

    public MessageResponse resendCode(String email) {
        cognitoService.resendConfirmationCode(email);
        return new MessageResponse("Confirmation code resent. Please check your email.");
    }

    // ── Sign-in ───────────────────────────────────────────────────────────────

    /**
     * Sign in with e-mail and password.
     *
     * The person must exist in OUR database as well as in Cognito. A Cognito account
     * with no RegulaOne record cannot be authorised for anything, so it is refused here
     * rather than being allowed a session it could not use.
     */
    public LoginResponse login(LoginRequest request) {
        Optional<User> user = userRepository.findByEmail(request.getEmail());

        if (user.isEmpty()) {
            throw new IllegalArgumentException(
                    "User not found in DB");
        }

        return cognitoService.signIn(request.getEmail(), request.getPassword());
    }

    /** Completes the NEW_PASSWORD_REQUIRED challenge for an invited user's first login. */
    public LoginResponse respondToChallenge(RespondChallengeRequest request) {
        return cognitoService.respondToNewPasswordChallenge(
                request.getUsername(), request.getSession(), request.getNewPassword());
    }

    /**
     * Exchange an unexpired refresh token for new short-lived tokens.
     *
     * WHY THE E-MAIL IS TRANSLATED TO A SUB FIRST (a real bug this fixed):
     *   The 'username' cookie stores the person's e-mail. This Cognito user pool,
     *   however, uses the UUID sub as the internal username — the e-mail is only an
     *   alias. AWS requires the SECRET_HASH for REFRESH_TOKEN_AUTH to be computed from
     *   the cognito:username (the UUID), not from the alias. Passing the e-mail produced
     *   a SECRET_HASH mismatch, so Cognito answered NotAuthorizedException and every
     *   refresh looked like "token expired" even with a perfectly valid token.
     */
    public LoginResponse refreshTokens(String refreshToken, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Session expired. Please log in again."));
        return cognitoService.refreshToken(refreshToken, user.getCognitoSub());
    }

    // ── Passwords ─────────────────────────────────────────────────────────────

    public void changePassword(ChangePasswordRequest request, String accessToken) {
        cognitoService.changePassword(
                accessToken, request.getCurrentPassword(), request.getNewPassword());
    }

    /**
     * Start a password recovery.
     *
     * The e-mail is trimmed but never logged, and the caller always receives the same
     * answer whether or not the account exists — this endpoint must not tell a stranger
     * who banks with us.
     */
    public void requestPasswordReset(ForgotPasswordRequest request) {
        cognitoService.forgotPassword(request.getEmail().trim());
    }

    /**
     * Finish a password recovery with the e-mailed code.
     *
     * The e-mail and code are trimmed (people paste them with stray spaces) but the new
     * password is passed through EXACTLY as typed — leading or trailing spaces are legal
     * characters in a password, and silently removing them would lock the person out of
     * the account they just created.
     */
    public void resetPassword(ResetPasswordRequest request) {
        cognitoService.confirmForgotPassword(
                request.getEmail().trim(),
                request.getCode().trim(),
                request.getNewPassword());
    }
}
