package com.privacypilot.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Details of the Data Protection Officer (in Polish: Inspektor Ochrony Danych,
 * IOD). Their contact details must appear on privacy notices (Art. 13(1)(b) /
 * 14(1)(b) GDPR).
 *
 * Poland adds a rule (Act of 10 May 2018): after appointing a DPO the company
 * must tell the authority (UODO) within 14 days, electronically. We store the
 * appointment date and the notification date so the app can watch that 14-day
 * clock and warn if it is about to be missed.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DpoDetails {

    // The DPO's full name.
    private String name;

    // The DPO's contact e-mail (published so people can reach them).
    private String email;

    // The DPO's contact phone number.
    private String phone;

    // When the DPO was appointed. Starts the 14-day UODO notification clock.
    private Instant appointedAt;

    // When UODO was told about the appointment. Null means "not notified yet".
    private Instant uodoNotifiedAt;

    // Whether the DPO's contact details are published on the company website.
    private boolean publishedOnWebsite;
}
