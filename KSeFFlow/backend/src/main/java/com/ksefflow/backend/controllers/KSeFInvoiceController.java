package com.ksefflow.backend.controllers;

import com.ksefflow.backend.dto.invoice.CreateInvoiceRequest;
import com.ksefflow.backend.dto.invoice.SubmitInvoiceResponse;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.services.KSeFInvoiceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

// REST API for the KSeF invoice pipeline.
//
// The controller is intentionally thin — it delegates ALL business logic to
// KSeFInvoiceService, following the Clean Architecture rule:
//   Controller → Service → Domain/Repository → Database
//
// Security: tenantId and userId are read from the request header (X-Tenant-Id,
// X-User-Id) in this initial implementation. Phase 5 will replace this with
// JWT claims extracted from the Authorization token via Spring Security.
//
// API versioning: all endpoints under /api/v1 to support future breaking changes.
@RestController
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
@Slf4j
public class KSeFInvoiceController {

    private final KSeFInvoiceService invoiceService;

    // ── Create ─────────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/invoices
     * Creates a new invoice in DRAFT status. Does not submit to KSeF.
     * Call POST /{id}/submit to start the submission pipeline.
     */
    @PostMapping
    public ResponseEntity<KsefInvoice> createInvoice(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Valid @RequestBody CreateInvoiceRequest request) {

        log.debug("Create invoice request: [{}] tenant [{}]",
                request.getInvoiceNumber(), tenantId);

        KsefInvoice invoice = invoiceService.createInvoice(
                request.toEntity(tenantId, userId));

        return ResponseEntity.status(HttpStatus.CREATED).body(invoice);
    }

    // ── Submit Pipeline ────────────────────────────────────────────────────────

    /**
     * POST /api/v1/invoices/{invoiceId}/submit
     * Runs the full KSeF submission pipeline:
     *   generate XML → validate → auth → send → poll → store UPO → SENT
     * On KSeF unavailability: → OFFLINE_MODE (PDF + QR + retry queue)
     *
     * @param nip the company's 10-digit NIP (required for KSeF authentication)
     */
    @PostMapping("/{invoiceId}/submit")
    public ResponseEntity<SubmitInvoiceResponse> submitInvoice(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String invoiceId,
            @RequestParam @NotBlank
            @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits")
            String nip) {

        log.info("Submit invoice [{}] tenant [{}] nip [{}]", invoiceId, tenantId, nip);

        KsefInvoice result = invoiceService.submitInvoice(tenantId, invoiceId, nip);

        String message = switch (result.getStatus()) {
            case SENT        -> "Invoice successfully submitted to KSeF — reference: " + result.getKsefId();
            case OFFLINE_MODE -> "KSeF unavailable — invoice queued for retry (offline mode)";
            default          -> "Submission result: " + result.getStatus();
        };

        SubmitInvoiceResponse response = SubmitInvoiceResponse.builder()
                .invoiceId(result.getId())
                .invoiceNumber(result.getInvoiceNumber())
                .status(result.getStatus())
                .ksefId(result.getKsefId())
                .upoDocumentId(result.getUpoDocumentId())
                .offlineQrCode(result.getOfflineQrCode())
                .message(message)
                .submittedAt(result.getSubmittedToKsefAt() != null
                        ? result.getSubmittedToKsefAt() : LocalDateTime.now())
                .environment(result.getKsefEnvironment())
                .build();

        HttpStatus httpStatus = result.getStatus() == KsefInvoiceStatus.SENT
                ? HttpStatus.OK : HttpStatus.ACCEPTED;

        return ResponseEntity.status(httpStatus).body(response);
    }

    // ── Read ───────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/invoices/{invoiceId}
     * Returns the invoice with current submission state.
     */
    @GetMapping("/{invoiceId}")
    public ResponseEntity<KsefInvoice> getInvoice(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String invoiceId) {

        return ResponseEntity.ok(invoiceService.getInvoice(tenantId, invoiceId));
    }

    /**
     * GET /api/v1/invoices
     * Paginated invoice list, optionally filtered by status.
     *
     * ?status=DRAFT|PENDING|SENT|FAILED|OFFLINE_MODE|RETRYING
     * ?page=0&size=20&sort=createdAt,desc
     */
    @GetMapping
    public ResponseEntity<Page<KsefInvoice>> listInvoices(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestParam(required = false) KsefInvoiceStatus status,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {

        return ResponseEntity.ok(invoiceService.listInvoices(tenantId, status, pageable));
    }

    // ── Error handling ─────────────────────────────────────────────────────────

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleConflict(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
    }
}
