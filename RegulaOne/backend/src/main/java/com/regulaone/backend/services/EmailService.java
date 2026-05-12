package com.regulaone.backend.services;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public void sendInvitationEmail(String toEmail, String name, String tempPassword) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject("You're Invited to RegulaOne");
        message.setText(
                "Hi " + name + ",\n\n" +
                "You have been invited to join RegulaOne.\n\n" +
                "Your temporary credentials:\n" +
                "  Email:    " + toEmail + "\n" +
                "  Password: " + tempPassword + "\n\n" +
                "Please log in and change your password immediately.\n\n" +
                "Best regards,\nRegulaOne Team"
        );
        mailSender.send(message);
    }
}
