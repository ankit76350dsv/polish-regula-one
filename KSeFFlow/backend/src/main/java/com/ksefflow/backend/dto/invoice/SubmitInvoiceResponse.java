package com.ksefflow.backend.dto.invoice;

import com.ksefflow.backend.models.utils.KsefEnvironment;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

// Response for POST /api/v1/invoices/{id}/submit.
// Returns enough information for the UI to update immediately without a
// follow-up GET — the ksefId (once SENT) or the two offline QR codes (when OFFLINE_MODE).
@Data
@Builder
public class SubmitInvoiceResponse {

    private String invoiceId;
    private String invoiceNumber;
    private KsefInvoiceStatus status;

    // Populated on status=SENT — the legally valid KSeF reference number
    private String ksefId;

    // Populated on status=SENT — ID of the stored UPO receipt document
    private String upoDocumentId;

    // Populated on status=OFFLINE_MODE — the two mandatory offline QR payloads.
    // qrCodeOffline = CODE I "OFFLINE"; qrCodeCertificate = CODE II "CERTYFIKAT".
    private String qrCodeOffline;
    private String qrCodeCertificate;

    // Human-readable summary of the submission result
    private String message;

    private LocalDateTime submittedAt;
    private KsefEnvironment environment;
}
