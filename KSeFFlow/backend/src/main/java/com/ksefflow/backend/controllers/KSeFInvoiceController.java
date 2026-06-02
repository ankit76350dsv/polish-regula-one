package com.ksefflow.backend.controllers;

import com.ksefflow.backend.dto.invoice.CreateInvoiceRequest;
import com.ksefflow.backend.dto.invoice.SubmitInvoiceResponse;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.security.AuthenticatedUser;
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
// Security: the authenticated caller (and their tenant) is resolved from the
// idToken cookie by delegating to the RegulaOne backend. Controllers receive an
// AuthenticatedUser parameter and MUST use its tenantId for scoping — the tenant
// is never taken from a client header, which enforces tenant isolation.
//
// API versioning: all endpoints under /api/v1 to support future breaking changes.
@RestController
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
@Slf4j
public class KSeFInvoiceController {

    private final KSeFInvoiceService invoiceService;

    // ── Create ─────────────────────────────────────────────────────────────────

    //!create draft of the invoce into the mongodb only...
    @PostMapping("/draft")
    public ResponseEntity<KsefInvoice> createInvoice(
            AuthenticatedUser caller,
            @Valid @RequestBody CreateInvoiceRequest request,
            HttpServletRequest httpRequest) {

        log.info("[CreateInvoice] ▶ POST /draft — invoiceNumber={} tenant={} user={}",
                request.getInvoiceNumber(), caller.tenantId(), caller.userId());

        KsefInvoice invoice = invoiceService.createInvoice(
                request.toEntity(caller.tenantId(), caller.userId()),
                caller.email(),
                extractClientIp(httpRequest));

        log.info("[CreateInvoice] ✔ Draft created — id={} status={} → 201 CREATED",
                invoice.getId(), invoice.getStatus());
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
            AuthenticatedUser caller,
            @PathVariable String invoiceId,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip,
            HttpServletRequest httpRequest) {

        log.info("[SubmitInvoice] ▶ POST /{}/submit — tenant={} nip={}", invoiceId, caller.tenantId(), nip);

        KsefInvoice result = invoiceService.submitInvoice(caller.tenantId(), invoiceId, nip,
                caller.email(), extractClientIp(httpRequest));
        log.info("[SubmitInvoice] submit pipeline finished — id={} status={}", result.getId(), result.getStatus());

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

        log.info("[SubmitInvoice] ✔ submit response — id={} status={} → {}",
                result.getId(), result.getStatus(), httpStatus);
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
            AuthenticatedUser caller,
            @PathVariable String invoiceId) {
        log.info("[GetInvoice] ▶ GET /{} — tenant={}", invoiceId, caller.tenantId());
        KsefInvoice invoice = invoiceService.getInvoice(caller.tenantId(), invoiceId);
        log.info("[GetInvoice] ✔ GET /{} — status={} → 200 OK", invoiceId, invoice.getStatus());
        return ResponseEntity.ok(invoice);
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
            AuthenticatedUser caller,
            @RequestParam(required = false) KsefInvoiceStatus status,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {

        log.info("[ListInvoices] ▶ GET / (list) — tenant={} status={} page={} size={}",
                caller.tenantId(), status, pageable.getPageNumber(), pageable.getPageSize());

        Page<KsefInvoice> page = invoiceService.listInvoices(caller.tenantId(), status, pageable);
        log.info("[ListInvoices] ✔ list — returned {} of {} invoices → 200 OK",
                page.getNumberOfElements(), page.getTotalElements());
        return ResponseEntity.ok(page);
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
        log.warn("[HandleBadRequest] ✘ 400 Bad Request — {}", e.getMessage());
        return ResponseEntity.badRequest().body(e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleConflict(IllegalStateException e) {
        log.warn("[HandleConflict] ✘ 409 Conflict — {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
    }
}
