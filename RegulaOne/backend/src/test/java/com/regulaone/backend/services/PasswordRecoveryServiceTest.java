package com.regulaone.backend.services;

import com.regulaone.backend.dto.Auth.ForgotPasswordRequest;
import com.regulaone.backend.dto.Auth.ResetPasswordRequest;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PasswordRecoveryServiceTest {

    private final RecordingCognitoService cognitoService = new RecordingCognitoService();
    private final UserService userService = new UserService(
            cognitoService, null, null, null, null, null);

    @Test
    void requestsResetUsingCanonicalEmailInput() {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("  account@example.com  ");

        userService.requestPasswordReset(request);

        assertEquals("account@example.com", cognitoService.requestedEmail);
    }

    @Test
    void confirmsResetWithoutChangingPasswordWhitespace() {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setEmail("  account@example.com  ");
        request.setCode("  123456  ");
        request.setNewPassword(" secure password ");

        userService.resetPassword(request);

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
            super("eu-central-1");
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
