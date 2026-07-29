package com.ksefflow.backend.controllers;

import com.ksefflow.backend.models.KsefReceivedInvoice;
import com.ksefflow.backend.security.AuthenticatedUser;
import com.ksefflow.backend.security.KsefPermission;
import com.ksefflow.backend.services.KsefReceivedInvoiceService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

// REST API for RECEIVED (purchase) invoices — invoices other companies issued to this tenant
// and that we pull from KSeF (faktury otrzymane). Mandatory capability from 1 Feb 2026.
//
// Thin controller — all logic lives in KsefReceivedInvoiceService. The tenant is always taken
// from the verified caller, never from a client header.
@RestController
@RequestMapping("/api/v1/received-invoices")
@RequiredArgsConstructor
@Slf4j
public class KsefReceivedInvoiceController {

    private final KsefReceivedInvoiceService receivedInvoiceService;

    /**
     * Sync purchase invoices from KSeF for a date window (defaults to the last 30 days).
     * Stores any new ones locally and reports how many were fetched / created.
     *
     * @param nip  the tenant's own 10-digit NIP (buyer context for KSeF authentication)
     * @param from optional window start (ISO, e.g. 2026-06-01T00:00:00)
     * @param to   optional window end — KSeF allows at most a 3-month span
     */
    // Permissions: KSEF_ADMIN (full access), KSEF_CASE_MANAGER (pull purchase
    //              invoices from KSeF). Read-only roles cannot trigger a sync.
    @PostMapping("/sync")
    public ResponseEntity<KsefReceivedInvoiceService.SyncResult> sync(
            AuthenticatedUser caller,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {

        // Pulling purchase invoices from KSeF is an issuer action — case manager or admin.
        caller.requireAnyPermission(KsefPermission.KSEF_ADMIN, KsefPermission.KSEF_CASE_MANAGER);

        log.info("[sync]:1 POST /received-invoices/sync — tenant={} nip={} from={} to={}",
                caller.tenantId(), nip, from, to);
        KsefReceivedInvoiceService.SyncResult result =
                receivedInvoiceService.syncReceivedInvoices(caller.tenantId(), nip, from, to);
        log.info("[sync]:2 sync result — fetched={} created={} skipped={}",
                result.fetched(), result.created(), result.skipped());
        return ResponseEntity.ok(result);
    }

    // Permissions: read access — KSEF_ADMIN, KSEF_CASE_MANAGER,
    //              KSEF_COMPLIANCE_OFFICER, KSEF_AUDITOR. (KSEF_EMPLOYEE has no invoice access.)
    /** Paginated list of received invoices for the tenant (metadata only). */
    @GetMapping
    public ResponseEntity<Page<KsefReceivedInvoice>> list(
            AuthenticatedUser caller,
            @PageableDefault(size = 20) Pageable pageable) {
        // Read access — issuers, oversight roles, or the tenant admin.
        caller.requireAnyPermission(KsefPermission.KSEF_ADMIN, KsefPermission.KSEF_CASE_MANAGER,
                KsefPermission.KSEF_COMPLIANCE_OFFICER, KsefPermission.KSEF_AUDITOR);
        log.info("[list]:1 GET /received-invoices — tenant={}", caller.tenantId());
        return ResponseEntity.ok(receivedInvoiceService.listReceived(caller.tenantId(), pageable));
    }

    /**
     * Download the full invoice XML for one received invoice. Fetched from KSeF on first request
     * and stored encrypted thereafter.
     *
     * @param nip the tenant's own 10-digit NIP (needed only if the XML must be fetched from KSeF)
     */
    // Permissions: read access — KSEF_ADMIN, KSEF_CASE_MANAGER,
    //              KSEF_COMPLIANCE_OFFICER, KSEF_AUDITOR. Returns invoice XML for review/export.
    @GetMapping(value = "/{ksefNumber}/xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getXml(
            AuthenticatedUser caller,
            @PathVariable String ksefNumber,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip) {
        // Read access — issuers, oversight roles, or the tenant admin.
        caller.requireAnyPermission(KsefPermission.KSEF_ADMIN, KsefPermission.KSEF_CASE_MANAGER,
                KsefPermission.KSEF_COMPLIANCE_OFFICER, KsefPermission.KSEF_AUDITOR);
        log.info("[getXml]:1 GET /received-invoices/{}/xml — tenant={}", ksefNumber, caller.tenantId());
        String xml = receivedInvoiceService.getReceivedInvoiceXml(caller.tenantId(), ksefNumber, nip);
        return ResponseEntity.ok(xml);
    }

    // ── Error handling (mirror of KSeFInvoiceController) ─────────────────────────

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException e) {
        log.warn("[handleBadRequest]:1 400 Bad Request — {}", e.getMessage());
        return ResponseEntity.badRequest().body(e.getMessage());
    }
}
