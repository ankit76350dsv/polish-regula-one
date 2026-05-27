package com.ksefflow.backend.controllers;

import com.ksefflow.backend.dto.invoice.CreateInvoiceRequest;
import com.ksefflow.backend.dto.invoice.SubmitInvoiceResponse;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.services.KSeFInvoiceService;
import jakarta.servlet.http.HttpServletRequest;
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
     * 
     * Create a new invoice.
     *
     * This API creates an invoice with DRAFT status.
     * The invoice is saved in the database but not sent to KSeF yet.
     *
     * To submit the invoice to KSeF,
     * call the submit API later.
     */
    @PostMapping
    public ResponseEntity<KsefInvoice> createInvoice(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @Valid @RequestBody CreateInvoiceRequest request,
            HttpServletRequest httpRequest) {

        log.debug("Create invoice request: [{}] tenant [{}]", request.getInvoiceNumber(), tenantId);

        KsefInvoice invoice = invoiceService.createInvoice(
                request.toEntity(tenantId, userId),
                userEmail,
                extractClientIp(httpRequest));

        return ResponseEntity.status(HttpStatus.CREATED).body(invoice);
    }

    // ── Submit Pipeline ────────────────────────────────────────────────────────
    /**
     * 
     * Submit an invoice to KSeF.
     *
     * This API starts the complete invoice submission process:
     * * Generate XML
     * * Validate invoice data
     * * Authenticate with KSeF
     * * Send invoice
     * * Save UPO(Urzędowe Poświadczenie Odbioru === Official Receipt Confirmation)
     * response
     *
     * If KSeF is unavailable,
     * the invoice will move to OFFLINE_MODE
     * and will be retried later.
     *
     * @param nip Company 10-digit NIP number
     */

    @PostMapping("/{invoiceId}/submit")
    public ResponseEntity<SubmitInvoiceResponse> submitInvoice(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @PathVariable String invoiceId,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip,
            HttpServletRequest httpRequest) {

        log.info("Submit invoice [{}] tenant [{}] nip [{}]", invoiceId, tenantId, nip);

        KsefInvoice result = invoiceService.submitInvoice(tenantId, invoiceId, nip,
                userEmail, extractClientIp(httpRequest));

        String message = switch (result.getStatus()) {
            case SENT -> "Invoice successfully submitted to KSeF — reference: " + result.getKsefId();
            case OFFLINE_MODE -> "KSeF unavailable — invoice queued for retry (offline mode)";
            default -> "Submission result: " + result.getStatus();
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
                        ? result.getSubmittedToKsefAt()
                        : LocalDateTime.now())
                .environment(result.getKsefEnvironment())
                .build();

        HttpStatus httpStatus = result.getStatus() == KsefInvoiceStatus.SENT
                ? HttpStatus.OK
                : HttpStatus.ACCEPTED;

        return ResponseEntity.status(httpStatus).body(response);
    }

    // ── Read ───────────────────────────────────────────────────────────────────

    /**
     * 
     * Get invoice details.
     * 
     * 
     * This API returns the invoice information
     * along with its current submission status.
     * 
     * 
     * Example statuses:
     ** DRAFT
     ** PENDING
     ** SENT
     ** FAILED
     ** OFFLINE_MODE
     */
    @GetMapping("/{invoiceId}")
    public ResponseEntity<KsefInvoice> getInvoice(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String invoiceId) {
        return ResponseEntity.ok(invoiceService.getInvoice(tenantId, invoiceId));
    }

    /**
     * Get all invoices.
     * 
     * 
     * This API returns a paginated list of invoices
     * for the current tenant.
     * 
     * 
     * You can also filter invoices by status.
     *
     * ?status=DRAFT|PENDING|SENT|FAILED|OFFLINE_MODE|RETRYING
     * ?page=0&size=20&sort=createdAt,desc
     */
    @GetMapping
    public ResponseEntity<Page<KsefInvoice>> listInvoices(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestParam(required = false) KsefInvoiceStatus status,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {

        log.info("Fetching invoices for tenantId={}, status={}, page={}, size={}",
                tenantId,
                status,
                pageable.getPageNumber(),
                pageable.getPageSize());

        return ResponseEntity.ok(invoiceService.listInvoices(tenantId, status, pageable));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    // Respects X-Forwarded-For set by load balancers / reverse proxies.
    // Falls back to the direct TCP remote address when the header is absent.
    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
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
