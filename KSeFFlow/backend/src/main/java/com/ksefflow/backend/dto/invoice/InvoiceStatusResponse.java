package com.ksefflow.backend.dto.invoice;

import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Compact view of an invoice's lifecycle: where it is NOW, what the user should do NEXT,
 * and the FULL ordered history of how it got there (DRAFT → PENDING → SENT → ...).
 *
 * Returned by GET /api/v1/invoices/{invoiceId}/status. The full history is also present on
 * the invoice document itself; this DTO is the convenient, UI-ready shape.
 */
@Data
@Builder
public class InvoiceStatusResponse {

    private String invoiceId;
    private String invoiceNumber;

    // ── Where it is now + what to do next ──────────────────────────────────────
    private KsefInvoiceStatus currentStatus;   // machine value, e.g. SENT
    private String currentStatusLabel;         // human label, e.g. "Sent"
    private String nextStep;                   // plain-language guidance for the user

    // ── Context that helps the user act on the current status ───────────────────
    private String lastErrorMessage;           // why it FAILED / went OFFLINE (null otherwise)
    private LocalDateTime ksefSubmissionDeadline; // when an offline invoice MUST reach KSeF
    private String ksefId;                      // official KSeF id (present once SENT)

    // ── Full timeline (oldest first) ────────────────────────────────────────────
    private List<Entry> history;

    @Data
    @Builder
    public static class Entry {
        private KsefInvoiceStatus status;   // status moved INTO at this point
        private String statusLabel;         // human label for the status
        private LocalDateTime timestamp;    // when it happened
        private String note;                // short reason, e.g. "Submitted to KSeF"
        private String changedBy;           // user email, or "SYSTEM" for automated jobs
    }

    /** Build the view from a stored invoice — no logic, just mapping. */
    public static InvoiceStatusResponse from(KsefInvoice invoice) {
        List<Entry> history = new ArrayList<>();
        if (invoice.getStatusHistory() != null) {
            invoice.getStatusHistory().forEach(h -> history.add(Entry.builder()
                    .status(h.getStatus())
                    .statusLabel(h.getStatus() != null ? h.getStatus().getLabel() : null)
                    .timestamp(h.getTimestamp())
                    .note(h.getNote())
                    .changedBy(h.getChangedBy())
                    .build()));
        }

        KsefInvoiceStatus status = invoice.getStatus();
        return InvoiceStatusResponse.builder()
                .invoiceId(invoice.getId())
                .invoiceNumber(invoice.getInvoiceNumber())
                .currentStatus(status)
                .currentStatusLabel(status != null ? status.getLabel() : null)
                .nextStep(status != null ? status.getNextStep() : null)
                .lastErrorMessage(invoice.getLastErrorMessage())
                .ksefSubmissionDeadline(invoice.getKsefSubmissionDeadline())
                .ksefId(invoice.getKsefId())
                .history(history)
                .build();
    }
}
