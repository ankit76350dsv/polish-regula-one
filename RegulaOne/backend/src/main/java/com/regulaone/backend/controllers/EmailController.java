package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.notification.SendEmail;
import com.regulaone.backend.services.notification.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@RestController
@RequestMapping("/api/email")
@RequiredArgsConstructor
public class EmailController {

        private final EmailService emailService;

        @Value("${notification.internal.service-token:}")
        private String serviceToken;

        @PostMapping("/send")
        public ResponseEntity<?> sendEmail(
                        @RequestHeader(value = "X-Service-Token", required = false) String token,
                        @RequestBody SendEmail request) {
                requireServiceToken(token);
                try {
                        emailService.sendEmail(request);
                        return ResponseEntity.ok().body(
                                        Map.of("success", true,"message", "Email sent successfully"));
                } catch (Exception e) {
                        return ResponseEntity.internalServerError().body(
                                        Map.of("success", false,"message", e.getMessage()));
                }
        }

        private void requireServiceToken(String token) {
                if (serviceToken == null || serviceToken.isBlank()) {
                        log.error("[email] notification.internal.service-token is not configured - rejecting");
                        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                                        "Email sending is not configured");
                }
                if (token == null || !constantTimeEquals(serviceToken, token)) {
                        log.warn("[email] invalid or missing X-Service-Token - rejected");
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid service token");
                }
        }

        private boolean constantTimeEquals(String a, String b) {
                if (a.length() != b.length()) {
                        return false;
                }
                int diff = 0;
                for (int i = 0; i < a.length(); i++) {
                        diff |= a.charAt(i) ^ b.charAt(i);
                }
                return diff == 0;
        }
}
