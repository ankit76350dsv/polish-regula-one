package com.regulaone.backend.dto.Admin;

import com.regulaone.backend.models.Invoice;
import lombok.*;

import java.math.BigDecimal;
import java.time.format.TextStyle;
import java.util.Locale;

// Response DTO for GET /api/admin/billing.
// Formats raw Invoice fields into the shapes the frontend billing table expects:
//   period   → "May 2026"
//   createdAt → "2026-05-01"
//   amount   → BigDecimal (frontend appends currency symbol from the currency field)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceResponse {

    private String id;
    private String invoiceNumber;
    private String packageName;
    private BigDecimal amount;
    private String currency;
    // Human-readable billing period — "May 2026"
    private String period;
    // ISO date string — "2026-05-01" — used for the Date column
    private String createdAt;
    // "FREE", "PAID", or "PENDING"
    private String status;

    public static InvoiceResponse from(Invoice invoice) {

        // Format billing period as "Month YYYY" (e.g. "May 2026")
        String period = "—";
        if (invoice.getPeriodStart() != null) {
            period = invoice.getPeriodStart()
                    .getMonth()
                    .getDisplayName(TextStyle.FULL, Locale.ENGLISH)
                    + " "
                    + invoice.getPeriodStart().getYear();
        }

        // Format createdAt as ISO date "2026-05-01"
        String createdAt = "—";
        if (invoice.getCreatedAt() != null) {
            createdAt = invoice.getCreatedAt().toLocalDate().toString();
        }

        return InvoiceResponse.builder()
                .id(invoice.getId())
                .invoiceNumber(invoice.getInvoiceNumber())
                .packageName(invoice.getPackageName())
                .amount(invoice.getAmount())
                .currency(invoice.getCurrency() != null ? invoice.getCurrency() : "EUR")
                .period(period)
                .createdAt(createdAt)
                .status(invoice.getStatus() != null ? invoice.getStatus().name() : null)
                .build();
    }
}
