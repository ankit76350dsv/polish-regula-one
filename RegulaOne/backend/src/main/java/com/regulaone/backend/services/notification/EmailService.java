package com.regulaone.backend.services.notification;

import com.regulaone.backend.dto.notification.SendEmail;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;

import java.util.Collections;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

        private final SesV2Client sesClient;

        @Value("${app.notifications.from}")
        private String fromAddress;

        public void sendEmail(SendEmail email) {

                if (fromAddress == null || fromAddress.isBlank()) {
                        throw new IllegalStateException(
                                        "app.notifications.from is not configured");
                }

                if (email == null) {
                        throw new IllegalArgumentException("Email request cannot be null");
                }

                if (email.getTo() == null || email.getTo().isEmpty()) {
                        throw new IllegalArgumentException("At least one recipient is required");
                }

                if (email.getSubject() == null || email.getSubject().isBlank()) {
                        throw new IllegalArgumentException("Subject is required");
                }

                String textBody = email.getTextBody() == null
                                ? ""
                                : email.getTextBody();

                String htmlBody = email.getHtmlBody() == null
                                ? ""
                                : email.getHtmlBody();

                SendEmailRequest request = SendEmailRequest.builder()
                                .fromEmailAddress(fromAddress)
                                .destination(
                                                Destination.builder()
                                                                .toAddresses(email.getTo())
                                                                .ccAddresses(
                                                                                email.getCc() == null
                                                                                                ? Collections.emptyList()
                                                                                                : email.getCc())
                                                                .bccAddresses(
                                                                                email.getBcc() == null
                                                                                                ? Collections.emptyList()
                                                                                                : email.getBcc())
                                                                .build())
                                .content(
                                                EmailContent.builder()
                                                                .simple(
                                                                                Message.builder()
                                                                                                .subject(
                                                                                                                Content.builder()
                                                                                                                                .data(email.getSubject())
                                                                                                                                .charset("UTF-8")
                                                                                                                                .build())
                                                                                                .body(
                                                                                                                Body.builder()
                                                                                                                                .text(
                                                                                                                                                Content.builder()
                                                                                                                                                                .data(textBody)
                                                                                                                                                                .charset("UTF-8")
                                                                                                                                                                .build())
                                                                                                                                .html(
                                                                                                                                                Content.builder()
                                                                                                                                                                .data(htmlBody)
                                                                                                                                                                .charset("UTF-8")
                                                                                                                                                                .build())
                                                                                                                                .build())
                                                                                                .build())
                                                                .build())
                                .build();

                sesClient.sendEmail(request);

                log.info(
                                "Email sent successfully. Subject='{}', Recipients={}",
                                email.getSubject(),
                                email.getTo().size());

                // ! how to use this
                // emailService.sendEmail(
                // SendEmail.builder()
                // .to(List.of(
                // "admin1@company.com",
                // "admin2@company.com"
                // ))
                // .cc(List.of(
                // "manager@company.com",
                // "compliance@company.com"
                // ))
                // .bcc(List.of(
                // "audit@company.com"
                // ))
                // .subject("New Whistleblower Report")
                // .textBody("A new report has been submitted.")
                // .htmlBody("""
                // <h1>New Whistleblower Report</h1>
                // <p>A new report has been submitted and requires review.</p>
                // """)
                // .build()
                // );
        }
}