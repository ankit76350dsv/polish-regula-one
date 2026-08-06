package com.regulaone.backend.auth;

import com.regulaone.backend.auth.dto.ForgotPasswordRequest;
import com.regulaone.backend.auth.dto.ResetPasswordRequest;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PasswordRecoveryServiceTest {

    private final RecordingCognitoService cognitoService = new RecordingCognitoService();

    // Password recovery moved out of UserService into AuthService during the backend
    // reorganisation. Only Cognito is exercised here, so the other collaborators stay null.
    private final AuthService authService = new AuthService(cognitoService, null, null);

    @Test
    void requestsResetUsingCanonicalEmailInput() {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("  account@example.com  ");

        authService.requestPasswordReset(request);

        assertEquals("account@example.com", cognitoService.requestedEmail);
    }

    @Test
    void confirmsResetWithoutChangingPasswordWhitespace() {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setEmail("  account@example.com  ");
        request.setCode("  123456  ");
        request.setNewPassword(" secure password ");

        authService.resetPassword(request);

        assertEquals("account@example.com", cognitoService.confirmedEmail);
        assertEquals("123456", cognitoService.confirmedCode);
        assertEquals(" secure password ", cognitoService.confirmedPassword);
    }

    private static final class RecordingCognitoService extends CognitoService {

        private String requestedEmail;
        private String confirmedEmail;
        private String confirmedCode;
        private String confirmedPassword;

        private RecordingCognitoService() {
            // Dummy credentials: this test overrides every method that would call AWS,
            // so nothing is ever sent — and passing explicit keys keeps the test from
            // picking up whatever happens to be in the developer's ~/.aws/credentials.
            super("eu-central-1", StaticCredentialsProvider.create(
                    AwsBasicCredentials.create("test", "test")));
        }

        @Override
        public void forgotPassword(String email) {
            requestedEmail = email;
        }

        @Override
        public void confirmForgotPassword(String email, String code, String newPassword) {
            confirmedEmail = email;
            confirmedCode = code;
            confirmedPassword = newPassword;
        }
    }
}
