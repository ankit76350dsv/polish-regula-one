package com.regulaone.backend.controllers;

import com.regulaone.backend.dto.notification.SendEmail;
import com.regulaone.backend.services.notification.EmailService;
import lombok.RequiredArgsConstructor;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/email")
@RequiredArgsConstructor
public class EmailController {

        private final EmailService emailService;

        @PostMapping("/send")
        public ResponseEntity<?> sendEmail(
                        @RequestBody SendEmail request) {
                try {
                        emailService.sendEmail(request);
                        return ResponseEntity.ok().body(
                                        Map.of("success", true,"message", "Email sent successfully"));
                } catch (Exception e) {
                        return ResponseEntity.internalServerError().body(
                                        Map.of("success", false,"message", e.getMessage()));
                }
        }
}