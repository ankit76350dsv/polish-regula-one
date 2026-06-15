package com.regulaone.backend.dto.notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendEmail{

    private List<String> to;
    private List<String> cc;
    private List<String> bcc;

    private String subject;

    private String textBody;
    private String htmlBody;
}