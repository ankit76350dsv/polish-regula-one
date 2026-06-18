package com.ksefflow.backend.controllers;

import com.ksefflow.backend.dto.invoice.CreateInvoiceRequest;
import com.ksefflow.backend.dto.invoice.SubmitInvoiceResponse;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.security.AuthenticatedUser;
import com.ksefflow.backend.security.KsefPermission;
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
    // Permissions: KSEF_TENANT_ADMIN (full access), KSEF_CASE_MANAGER (issue invoices).
    //              KSEF_COMPLIANCE_OFFICER / KSEF_AUDITOR are read-only and cannot create.
    @PostMapping("/draft")
    public ResponseEntity<KsefInvoice> createInvoice(
            AuthenticatedUser caller,
            @Valid @RequestBody CreateInvoiceRequest request,
            HttpServletRequest httpRequest) {

        // Only invoice issuers (or the tenant admin) may create invoices.
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN, KsefPermission.KSEF_CASE_MANAGER);

        log.info("[createInvoice]:1 ▶ POST /draft — invoiceNumber={} tenant={} user={}",
                request.getInvoiceNumber(), caller.tenantId(), caller.userId());

        KsefInvoice invoice = invoiceService.createInvoice(
                request.toEntity(caller.tenantId(), caller.userId()),
                caller.email(),
                extractClientIp(httpRequest));

        log.info("[createInvoice]:2 ✔ Draft created — id={} status={} → 201 CREATED",
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
    // Permissions: KSEF_TENANT_ADMIN (full access), KSEF_CASE_MANAGER (submit to KSeF).
    //              Read-only roles (KSEF_COMPLIANCE_OFFICER / KSEF_AUDITOR) cannot submit.
    @PostMapping("/{invoiceId}/submit")
    public ResponseEntity<SubmitInvoiceResponse> submitInvoice(
            AuthenticatedUser caller,
            @PathVariable String invoiceId,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip,
            HttpServletRequest httpRequest) {

        // Only invoice issuers (or the tenant admin) may submit to KSeF.
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN, KsefPermission.KSEF_CASE_MANAGER);

        log.info("[submitInvoice]:1 POST /{}/submit — tenant={} nip={}", invoiceId, caller.tenantId(), nip);

        KsefInvoice result = invoiceService.submitInvoice(caller.tenantId(), invoiceId, nip,
                caller.email(), extractClientIp(httpRequest));
        log.info("[submitInvoice]:2 submit pipeline finished — id={} status={}", result.getId(), result.getStatus());

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
                .qrCodeInvoice(result.getQrCodeInvoice())
                .qrCodeCertificate(result.getQrCodeCertificate())
                .message(message)
                .submittedAt(result.getSubmittedToKsefAt() != null
                        ? result.getSubmittedToKsefAt()
                        : LocalDateTime.now())
                .environment(result.getKsefEnvironment())
                .build();

        HttpStatus httpStatus = result.getStatus() == KsefInvoiceStatus.SENT
                ? HttpStatus.OK
                : HttpStatus.ACCEPTED;

        log.info("[submitInvoice]:3 submit response — id={} status={} → {}",
                result.getId(), result.getStatus(), httpStatus);
        return ResponseEntity.status(httpStatus).body(response);
    }

    // ── Correction (faktura korygująca) ──────────────────────────────────────────

    /**
     * Create a CORRECTION invoice for an invoice that is already in KSeF.
     *
     * The request body is the corrected invoice content (same shape as creating a normal
     * invoice). The new invoice is linked to the original (by its KSeF number) and saved as a
     * DRAFT — submit it afterwards with POST /{id}/submit like any other invoice.
     *
     * @param invoiceId      the original invoice being corrected (must be SENT)
     * @param reason         why the correction is needed (FA(3) PrzyczynaKorekty)
     * @param correctionType optional KSeF correction type 1/2/3 (FA(3) TypKorekty)
     */
    // Permissions: KSEF_TENANT_ADMIN (full access), KSEF_CASE_MANAGER (issue corrections).
    //              Read-only roles cannot create correction invoices.
    @PostMapping("/{invoiceId}/correct")
    public ResponseEntity<KsefInvoice> correctInvoice(
            AuthenticatedUser caller,
            @PathVariable String invoiceId,
            @Valid @RequestBody CreateInvoiceRequest request,
            @RequestParam @NotBlank(message = "A correction reason is required") String reason,
            @RequestParam(required = false) Integer correctionType,
            HttpServletRequest httpRequest) {

        // Only invoice issuers (or the tenant admin) may issue correction invoices.
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN, KsefPermission.KSEF_CASE_MANAGER);

        log.info("[correctInvoice]:1 POST /{}/correct — tenant={} newNumber={}",
                invoiceId, caller.tenantId(), request.getInvoiceNumber());
        KsefInvoice correction = invoiceService.createCorrection(
                caller.tenantId(), invoiceId,
                request.toEntity(caller.tenantId(), caller.userId()),
                reason, correctionType,
                caller.email(), extractClientIp(httpRequest));
        log.info("[correctInvoice]:2 Correction draft created — id={} corrects={}",
                correction.getId(), correction.getCorrectedKsefNumber());
        return ResponseEntity.status(HttpStatus.CREATED).body(correction);
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
    // Permissions: read access — KSEF_TENANT_ADMIN, KSEF_CASE_MANAGER,
    //              KSEF_COMPLIANCE_OFFICER, KSEF_AUDITOR. (KSEF_EMPLOYEE has no invoice access.)
    @GetMapping("/{invoiceId}")
    public ResponseEntity<KsefInvoice> getInvoice(
            AuthenticatedUser caller,
            @PathVariable String invoiceId) {
        // Read access — issuers, oversight roles, or the tenant admin.
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN, KsefPermission.KSEF_CASE_MANAGER,
                KsefPermission.KSEF_COMPLIANCE_OFFICER, KsefPermission.KSEF_AUDITOR);
        log.info("[getInvoice]:1 ▶ GET /{} — tenant={}", invoiceId, caller.tenantId());
        KsefInvoice invoice = invoiceService.getInvoice(caller.tenantId(), invoiceId);
        log.info("[getInvoice]:2 ✔ GET /{} — status={} → 200 OK", invoiceId, invoice.getStatus());
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
    // Permissions: read access — KSEF_TENANT_ADMIN, KSEF_CASE_MANAGER,
    //              KSEF_COMPLIANCE_OFFICER, KSEF_AUDITOR. (KSEF_EMPLOYEE has no invoice access.)
    @GetMapping
    public ResponseEntity<Page<KsefInvoice>> listInvoices(
            AuthenticatedUser caller,
            @RequestParam(required = false) KsefInvoiceStatus status,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {

        // Read access — issuers, oversight roles, or the tenant admin.
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN, KsefPermission.KSEF_CASE_MANAGER,
                KsefPermission.KSEF_COMPLIANCE_OFFICER, KsefPermission.KSEF_AUDITOR);

        log.info("[listInvoices]:1 ▶ GET / (list) — tenant={} status={} page={} size={}",
                caller.tenantId(), status, pageable.getPageNumber(), pageable.getPageSize());

        Page<KsefInvoice> page = invoiceService.listInvoices(caller.tenantId(), status, pageable);
        log.info("[listInvoices]:2 ✔ list — returned {} of {} invoices → 200 OK",
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
        log.warn("[handleBadRequest]:1 ✘ 400 Bad Request — {}", e.getMessage());
        return ResponseEntity.badRequest().body(e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleConflict(IllegalStateException e) {
        log.warn("[handleConflict]:1 ✘ 409 Conflict — {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
    }
}
