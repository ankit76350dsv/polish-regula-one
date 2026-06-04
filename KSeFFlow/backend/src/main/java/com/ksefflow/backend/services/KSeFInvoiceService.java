package com.ksefflow.backend.services;

import com.ksefflow.backend.services.fa3xml.FA3XmlGeneratorService;
import com.ksefflow.backend.services.fa3xml.FA3XmlValidatorService;

import com.ksefflow.backend.services.ksefauth.KSeFAuthService;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.KsefInvoiceStatusResponse;
import com.ksefflow.backend.dto.ksefapi.KsefSendInvoiceResponse;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.exceptions.KsefSubmissionException;
import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.models.utils.KsefOfflineMode;
import com.ksefflow.backend.models.utils.KsefUpoStatus;
import com.ksefflow.backend.repository.KsefInvoiceRepository;
import com.ksefflow.backend.services.ksefauth.KsefApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Optional;

/**
 * KSeFInvoiceService — Phase 4 Orchestrator.
 *
 * Ties together all previously built services into the full invoice submission
 * pipeline:
 *
 * 1. validateDraft — guard: invoice must exist and be in DRAFT status
 * 2. generateXml — FA3XmlGeneratorService converts KsefInvoice → FA(3) XML
 * 3. validateXml — FA3XmlValidatorService strict-validates XML before touching
 * KSeF API
 * 4. openSession — KSeFAuthService challenge-response auth → session token
 * 5. sendInvoice — KsefApiClient POST /online/Invoice/Send →
 * elementReferenceNumber
 * 6. pollStatus — KsefApiClient GET /online/Invoice/Status →
 * ksefReferenceNumber
 * 7. storeUpo — UPOStorageService encrypts + persists the UPO receipt
 * 8. markSent — updates KsefInvoice: status=SENT, ksefId, upoDocumentId
 * 9. auditLog — immutable audit trail of every action
 *
 * Offline fallback (steps 5–8 fail):
 * → OfflineQrService generates the two mandatory QR codes (OFFLINE + CERTYFIKAT)
 * → invoice set to OFFLINE_MODE with offlineMode, offlineIssuedAt, and the legal
 *   ksefSubmissionDeadline; offline data is RETAINED for audit even after success
 * → the human-readable PDF is produced CLIENT-SIDE from the invoice + QR payloads
 * → RetryQueueService (Phase 5) re-submits before the deadline with exponential backoff
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KSeFInvoiceService {

    private final KsefInvoiceRepository ksef_invoices_repository;

    private final FA3XmlGeneratorService xmlGeneratorService;
    private final FA3XmlValidatorService xmlValidatorService;
    private final KSeFAuthService authService;
    private final KsefApiClient ksefApiClient;
    private final UPOStorageService upoStorageService;
    private final OfflineQrService offlineQrService;
    private final KsefApiProperties apiProperties;

    //! ── Create ─────────────────────────────────────────────────────────────────

    /**
     * Persists an invoice in DRAFT status.
     * No XML is generated or validated at this stage — the user can still edit the
     * invoice.
     *
     * Idempotent on (tenantId, invoiceNumber):
     * - if an invoice with the same number already exists and is still a DRAFT,
     * it is UPDATED in place (re-saving a draft is not an error);
     * - if it exists but has moved past DRAFT (PENDING/SENT/…), it is a real
     * duplicate and is rejected — a finalized invoice cannot be re-created.
     */
    public KsefInvoice createInvoice(KsefInvoice invoice, String userEmail, String ipAddress) {
        // Look up any existing invoice with this number for the tenant.
        Optional<KsefInvoice> existingOpt = ksef_invoices_repository
                .findByTenantIdAndInvoiceNumber(invoice.getTenantId(), invoice.getInvoiceNumber());

        if (existingOpt.isPresent()) {
            KsefInvoice existing = existingOpt.get();

            // Already finalized (or in-flight) → re-creating it is a genuine conflict.
            if (existing.getStatus() != KsefInvoiceStatus.DRAFT) {
                log.error("Invoice number [{}] already exists for tenant [{}] with status [{}] — cannot re-create",
                        invoice.getInvoiceNumber(), invoice.getTenantId(), existing.getStatus());
                throw new IllegalArgumentException(
                        "Invoice number [" + invoice.getInvoiceNumber() +
                                "] already exists for tenant [" + invoice.getTenantId() +
                                "] and is no longer a draft (status " + existing.getStatus() + ")");
            }

            // Still a DRAFT → update it in place. Keep the original id + createdAt,
            // overwrite the editable data with the incoming draft, bump updatedAt.
            log.info("Invoice [{}] already a DRAFT for tenant [{}] — updating existing draft [{}]",
                    existing.getInvoiceNumber(), existing.getTenantId(), existing.getId());

            invoice.setId(existing.getId());
            invoice.setCreatedAt(existing.getCreatedAt());
            invoice.setUpdatedAt(LocalDateTime.now());
            invoice.setStatus(KsefInvoiceStatus.DRAFT);
            invoice.setKsefEnvironment(apiProperties.getEnvironment());

            KsefInvoice updated = ksef_invoices_repository.save(invoice);

            KSeFAuditLogService.writeAuditLog(
                    updated.getTenantId(),
                    "INVOICE_DRAFT_UPDATED",
                    updated.getId(),
                    null,
                    "invoiceNumber=" + updated.getInvoiceNumber(),
                    userEmail,
                    ipAddress);

            log.info("Invoice [{}] DRAFT updated successfully for tenant [{}]",
                    updated.getInvoiceNumber(), updated.getTenantId());
            return updated;
        }

        // No existing invoice → create a fresh DRAFT.
        invoice.setStatus(KsefInvoiceStatus.DRAFT);
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setKsefEnvironment(apiProperties.getEnvironment());
        KsefInvoice saved = ksef_invoices_repository.save(invoice);

        log.info("Writing audit log for invoice creation. Invoice ID [{}]", saved.getId());

        KSeFAuditLogService.writeAuditLog(
                saved.getTenantId(),
                "INVOICE_CREATED",
                saved.getId(),
                null,
                "invoiceNumber=" + saved.getInvoiceNumber(),
                userEmail,
                ipAddress);

        log.info("Invoice [{}] created successfully as DRAFT for tenant [{}]",
                saved.getInvoiceNumber(), saved.getTenantId());

        return saved;
    }

    //! ── Submit Pipeline ────────────────────────────────────────────────────────

    /**
     * Executes the full KSeF submission pipeline for the given invoice.
     *
     * On success: invoice transitions DRAFT → PENDING → SENT with ksefId populated.
     * On KSeF failure: invoice transitions to OFFLINE_MODE for retry.
     *
     * @param tenantId  tenant making the request
     * @param invoiceId the KsefInvoice._id to submit
     * @param nip       the company's 10-digit Polish tax ID (used for KSeF session
     *                  auth)
     * @return the submitted invoice with ksefId, upoDocumentId, and status=SENT
     * @throws IllegalStateException      if the invoice is not in DRAFT status
     * @throws KsefXmlGenerationException if FA(3) XML cannot be built or validated
     * @throws KsefAuthException          if KSeF session cannot be opened
     *                                    (certificate problem)
     */
    public KsefInvoice submitInvoice(String tenantId, String invoiceId, String nip, String userEmail, String ipAddress) {

        log.info("[SubmitInvoice] Starting invoice submission process. TenantId=[{}], InvoiceId=[{}], NIP=[{}]", tenantId, invoiceId, nip);

        // Step 1 — Load and validate DRAFT invoice
        KsefInvoice invoice = loadAndGuardDraft(tenantId, invoiceId);

        // ! Step 2 — Move invoice to PENDING state
        invoice.setStatus(KsefInvoiceStatus.PENDING);
        invoice.setUpdatedAt(LocalDateTime.now());
        int nextAttempt = invoice.getSubmissionAttempts() + 1;
        invoice.setSubmissionAttempts(nextAttempt);

        log.info("[SubmitInvoice] Submission attempt count updated to [{}] and saving PENDING invoice state into database for invoice [{}]", nextAttempt, invoice.getInvoiceNumber());

        ksef_invoices_repository.save(invoice);

        // Audit log for submission attempt
        log.info("[SubmitInvoice] Creating audit log entry for invoice submission attempt. InvoiceId=[{}]", invoiceId);

        KSeFAuditLogService.writeAuditLog(tenantId, "INVOICE_SUBMISSION_STARTED", invoiceId, null, "attempt=" + invoice.getSubmissionAttempts(), userEmail, ipAddress);

        // ! Step 3 — Generate FA(3) XML
        // ! return two thiing XML and hashof XML
        FA3XmlGeneratorService.FA3XmlResult xmlResult = xmlGeneratorService.generateXml(invoice);

        // Step 4 — Validate XML
        xmlValidatorService.validateStrict(xmlResult.xmlContent());
        // Save XML hash
        invoice.setFa3XmlHash(xmlResult.sha256Hash());
        ksef_invoices_repository.save(invoice);

        // Step 5–8 — Submit invoice to KSeF
        try {

            KsefInvoice submittedInvoice = executeKsefSubmission(invoice, xmlResult.xmlContent(), nip, userEmail, ipAddress);
            log.info("[SubmitInvoice] Invoice [{}] submitted successfully to KSeF", invoice.getInvoiceNumber());
            return submittedInvoice;

        } catch (KsefSubmissionException | KsefAuthException e) {

            // KSeF was reachable-but-rejected or unreachable at the session/network layer →
            // this is the system-detected "KSeF unavailability" offline mode. (offline24 vs
            // emergency are user/MF-declared and would be passed in explicitly.)
            log.warn("[SubmitInvoice] KSeF submission failed for invoice [{}]. Reason=[{}]. Switching to OFFLINE_MODE", invoice.getInvoiceNumber(), e.getMessage());
            return handleOfflineMode(invoice, KsefOfflineMode.OFFLINE_UNAVAILABILITY, e.getMessage(), userEmail, ipAddress);
        }
    }

    // ── Read ───────────────────────────────────────────────────────────────────

    public KsefInvoice getInvoice(String tenantId, String invoiceId) {
        return ksef_invoices_repository.findById(invoiceId)
                .filter(inv -> tenantId.equals(inv.getTenantId()))
                .filter(inv -> !inv.isSoftDeleted())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Invoice [" + invoiceId + "] not found for tenant [" + tenantId + "]"));
    }

    public Page<KsefInvoice> listInvoices(String tenantId, KsefInvoiceStatus status, Pageable pageable) {
        if (status != null) {
            return ksef_invoices_repository.findByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, status, pageable);
        }
        return ksef_invoices_repository.findByTenantIdOrderByCreatedAtDesc(tenantId, pageable);
    }

    // ! ── Private: KSeF network pipeline ─────────────────────────────────────────

    private KsefInvoice executeKsefSubmission(KsefInvoice invoice,
            String xmlContent, String nip,
            String userEmail, String ipAddress) {

        log.info("[ExecuteKsefSubmission] Starting KSeF invoice submission flow for invoice [{}]",
                invoice.getInvoiceNumber());

        String tenantId = invoice.getTenantId();
        String invoiceId = invoice.getId();

        // Step 5 — open / reuse KSeF government session
        // TODO: 1st step to get {Header: SessionToken: 20230615-SE-...}
        String sessionToken = authService.openSession(tenantId, nip);

        log.debug("[ExecuteKsefSubmission] Session token acquired successfully for tenant [{}]", tenantId);

        // Step 6 — POST the FA(3) XML to KSeF
        LocalDateTime submittedAt = LocalDateTime.now();

        // TODO: last step of the sending invoce to goverment { Header: SessionToken: 20230615-SE-... | Body: <FA3 XML bytes> }
        KsefSendInvoiceResponse sendResponse = ksefApiClient.sendInvoice(sessionToken, xmlContent);
        String elementRef = sendResponse.getElementReferenceNumber();

        log.info("[ExecuteKsefSubmission] Invoice [{}] accepted by KSeF — elementRef: [{}]",
                invoice.getInvoiceNumber(),
                elementRef);

        // Step 7 — poll for the permanent KSeF reference number + acquisition
        // timestamp.
        // In production this can take a few seconds; the sandbox usually responds
        // immediately.
        KsefPollResult pollResult = pollForKsefId(sessionToken, elementRef, invoice.getInvoiceNumber());
        String ksefId = pollResult.ksefReferenceNumber();
        LocalDateTime receivedAt = LocalDateTime.now();
        log.info("[ExecuteKsefSubmission] Permanent KSeF reference number received for invoice [{}] — ksefId [{}]",
                invoice.getInvoiceNumber(),
                ksefId);

        // Prefer the government's own acquisitionTimestamp; fall back to sendResponse
        // timestamp,
        // then to the local clock — so the UPO is stamped with the legally correct
        // time.
        LocalDateTime upoTimestamp = extractTimestamp(
                pollResult.acquisitionTimestamp() != null
                        ? pollResult.acquisitionTimestamp()
                        : sendResponse.getTimestamp(),
                receivedAt);


        // Step 8 — fetch the real UPO XML from KSeF (production).
        // In sandbox KSeF does not return a UPO body, so we fall back to the stub.
        // TODO: get the receipt using the sessionToken and ksfid that we get after
        //! recpeit not the invoice.
        String upoXml = ksefApiClient.fetchUpoXml(sessionToken, ksefId)
                .orElseGet(() -> {
                    log.warn(
                            "[ExecuteKsefSubmission] KSeF did not return UPO XML — generating fallback UPO for invoice [{}]",
                            invoice.getInvoiceNumber());

                    return buildUpoXml(invoice, ksefId, upoTimestamp);
                });
        String upoDocumentId = upoStorageService.storeUpo( invoiceId, tenantId, ksefId, upoXml, upoTimestamp);

        // Step 9 — mark invoice as SENT
        //! invoce update...
        log.info("[ExecuteKsefSubmission] Updating invoice status to SENT for invoice [{}]",
                invoice.getInvoiceNumber());
        invoice.setStatus(KsefInvoiceStatus.SENT);
        invoice.setKsefId(ksefId); // ! ksefReferenceNumber
        invoice.setUpoDocumentId(upoDocumentId); // ! mongodb _id of the invoice
        invoice.setUpoStatus(KsefUpoStatus.RECEIVED);
        invoice.setUpoTimestamp(upoTimestamp); // ! when get the sendinvoice response
        invoice.setSubmittedToKsefAt(submittedAt);
        invoice.setReceivedFromKsefAt(receivedAt); // ! when get ksefReferenceNumber
        invoice.setLastErrorMessage(null);

        // CODE I (KOD I) — required by the MF QR spec on ANY invoice shared outside KSeF
        // (PDF/print/email), online OR offline. It is unsigned (NIP + issue date + XML hash),
        // so no certificate is needed. The frontend labels it with the KSeF number once SENT.
        // (CODE II / "CERTYFIKAT" is offline-only and is NOT generated here.)
        try {
            invoice.setQrCodeOffline(offlineQrService.generateOfflineCode(invoice));
        } catch (Exception qrEx) {
            // Never fail a successful KSeF submission because of QR generation.
            log.warn("[ExecuteKsefSubmission] CODE I generation failed for SENT invoice [{}]: {}",
                    invoice.getInvoiceNumber(), qrEx.getMessage());
        }

        invoice.setUpdatedAt(LocalDateTime.now());
        log.info("[ExecuteKsefSubmission] Saving updated invoice state into database for invoice [{}]",
                invoice.getInvoiceNumber());

        KsefInvoice saved = ksef_invoices_repository.save(invoice);
        KSeFAuditLogService.writeAuditLog(tenantId, "INVOICE_SENT_TO_KSEF", invoiceId, null, "ksefId=" + ksefId + " env=" + apiProperties.getEnvironment(), userEmail, ipAddress);
        log.info("[ExecuteKsefSubmission] Invoice [{}] successfully registered with KSeF and submission flow completed — ksefId: [{}]", invoice.getInvoiceNumber(), ksefId);
        return saved;
    }

    // Carries both the permanent KSeF reference number and the government's own
    // acquisition timestamp so the UPO is stamped with the legally correct time.
    private record KsefPollResult(String ksefReferenceNumber, String acquisitionTimestamp) {
    }

    //! Polls GET /online/Invoice/Status until a ksefReferenceNumber is returned.
    // Retries up to 5 times with 1-second gaps — adequate for sandbox + production.
   private KsefPollResult pollForKsefId(String sessionToken, String elementRef, String invoiceNumber) {
    int maxAttempts = 5;
    log.info("[PollForKsefId] Starting KSeF polling for invoice [{}] with elementRef [{}]", invoiceNumber, elementRef);
    
    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
        
        log.debug("[PollForKsefId] Checking KSeF invoice status for invoice [{}] — attempt {}/{}", invoiceNumber, attempt, maxAttempts);
        KsefInvoiceStatusResponse statusResponse = ksefApiClient.getInvoiceStatus(sessionToken, elementRef);
        
        if (statusResponse.getInvoiceStatus() != null && statusResponse.getInvoiceStatus().getKsefReferenceNumber() != null) {
            log.info("[PollForKsefId] KSeF reference number generated successfully for invoice [{}] — ksefRef [{}]", invoiceNumber, statusResponse.getInvoiceStatus().getKsefReferenceNumber());
            return new KsefPollResult(statusResponse.getInvoiceStatus().getKsefReferenceNumber(), statusResponse.getInvoiceStatus().getAcquisitionTimestamp());
        }

        if (attempt < maxAttempts) {
            log.debug("[PollForKsefId] KSeF reference number not yet available for invoice [{}] — retrying in 1s", invoiceNumber);
            sleepQuietly(1000);
        }
    }

    log.error("[PollForKsefId] KSeF did not assign reference number after [{}] attempts for invoice [{}]", maxAttempts, invoiceNumber);
    throw new KsefSubmissionException("KSeF did not assign a reference number after " + maxAttempts + " polling attempts for elementRef: " + elementRef);
   }

    //! ── Private: offline fallback ──────────────────────────────────────────────

    // Parks an invoice in OFFLINE_MODE in a legally-compliant way.
    //
    // NOTE: the PDF is intentionally NOT generated here — the legal record is the FA(3)
    // XML in KSeF, and the human-readable visualization (PDF) is produced client-side from
    // the invoice data + the two QR payloads computed below. This method only:
    //   1. records the legally-significant offline issuance time (once),
    //   2. computes the legal KSeF submission deadline for the mode,
    //   3. generates the two mandatory QR codes (CODE I "OFFLINE" + CODE II "CERTYFIKAT"),
    //   4. persists OFFLINE_MODE + an immutable audit entry.
    // The retry scheduler must re-submit before ksefSubmissionDeadline; on success the
    // offline fields are RETAINED (never deleted) for audit — see the markSent step.
    private KsefInvoice handleOfflineMode(KsefInvoice invoice, KsefOfflineMode mode,
                                          String errorMessage, String userEmail, String ipAddress) {
        LocalDateTime now = LocalDateTime.now();

        // Offline issuance time is set ONCE and never overwritten on later retries — it is
        // the legally significant moment the invoice was issued outside KSeF.
        if (invoice.getOfflineIssuedAt() == null) {
            invoice.setOfflineIssuedAt(now);
        }
        invoice.setOfflineMode(mode);
        invoice.setKsefSubmissionDeadline(computeSubmissionDeadline(mode, invoice.getOfflineIssuedAt()));

        // Two QR codes per MF offline rules, generated server-side. CODE II ("CERTYFIKAT")
        // REQUIRES an OFFLINE-purpose KSeF certificate. If the tenant has not provisioned one
        // we must NOT fabricate a partial/invalid visualization — we leave BOTH QR codes empty
        // and record an explicit compliance block. The invoice is still parked OFFLINE_MODE so
        // it is not lost and will be retried to KSeF (online retry does not need the offline cert).
        String complianceNote = null;
        try {
            // Generate CODE II first — it is the gated one (throws if no OFFLINE cert).
            String codeCertificate = offlineQrService.generateCertificateCode(invoice); // CODE II "CERTYFIKAT"
            String codeOffline     = offlineQrService.generateOfflineCode(invoice);     // CODE I  "OFFLINE"
            invoice.setQrCodeOffline(codeOffline);
            invoice.setQrCodeCertificate(codeCertificate);
            log.info("[HandleOfflineMode] Offline QR codes generated for invoice [{}] (mode={})",
                    invoice.getInvoiceNumber(), mode);
        } catch (KsefCertificateException ce) {
            // No OFFLINE-type KSeF certificate → a compliant offline invoice cannot be issued.
            invoice.setQrCodeOffline(null);
            invoice.setQrCodeCertificate(null);
            complianceNote = "OFFLINE_CERT_REQUIRED: " + ce.getMessage();
            log.error("[HandleOfflineMode] COMPLIANCE BLOCK for invoice [{}] — {}",
                    invoice.getInvoiceNumber(), ce.getMessage());
        } catch (Exception qrEx) {
            invoice.setQrCodeOffline(null);
            invoice.setQrCodeCertificate(null);
            complianceNote = "QR_GENERATION_FAILED: " + qrEx.getMessage();
            log.error("[HandleOfflineMode] Failed to generate offline QR codes for invoice [{}]: {}",
                    invoice.getInvoiceNumber(), qrEx.getMessage(), qrEx);
        }

        invoice.setStatus(KsefInvoiceStatus.OFFLINE_MODE);
        invoice.setLastErrorMessage(complianceNote != null ? errorMessage + " | " + complianceNote : errorMessage);
        invoice.setLastRetryAt(now);
        invoice.setUpdatedAt(now);
        KsefInvoice saved = ksef_invoices_repository.save(invoice);

        KSeFAuditLogService.writeAuditLog(invoice.getTenantId(), "INVOICE_OFFLINE_MODE", invoice.getId(),
                null,
                "mode=" + mode + " deadline=" + invoice.getKsefSubmissionDeadline() + " reason=" + errorMessage,
                userEmail, ipAddress);

        log.warn("[HandleOfflineMode] Invoice [{}] parked OFFLINE (mode={}) — MUST reach KSeF by [{}]",
                invoice.getInvoiceNumber(), mode, invoice.getKsefSubmissionDeadline());
        return saved;
    }

    // Computes the legal deadline by which an offline invoice must be accepted by KSeF.
    //   offline24 / KSeF-unavailability → end of the NEXT business day
    //   emergency (tryb awaryjny)       → end of the 7th business day
    // NOTE: skips weekends only — Polish public holidays are NOT accounted for here and
    // should be added (a holiday calendar) before relying on this for hard deadlines.
    private LocalDateTime computeSubmissionDeadline(KsefOfflineMode mode, LocalDateTime from) {
        int businessDays = (mode == KsefOfflineMode.EMERGENCY) ? 7 : 1;
        LocalDate day = from.toLocalDate();
        int added = 0;
        while (added < businessDays) {
            day = day.plusDays(1);
            if (day.getDayOfWeek() != DayOfWeek.SATURDAY && day.getDayOfWeek() != DayOfWeek.SUNDAY) {
                added++;
            }
        }
        return day.atTime(23, 59, 59); // end of the business day
    }

    // ── Private: helpers ───────────────────────────────────────────────────────

    private KsefInvoice loadAndGuardDraft(String tenantId, String invoiceId) {
        KsefInvoice invoice = ksef_invoices_repository.findById(invoiceId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Invoice [" + invoiceId + "] not found"));

        if (!tenantId.equals(invoice.getTenantId())) {
            throw new IllegalArgumentException("Access denied to invoice [" + invoiceId + "]");
        }
        if (invoice.getStatus() != KsefInvoiceStatus.DRAFT) {
            throw new IllegalStateException(
                    "Invoice [" + invoiceId + "] is not in DRAFT status. " +
                            "Current status: " + invoice.getStatus());
        }
        return invoice;
    }

    // ! try to understand what is this doing................
    // Builds a simple fallback UPO XML document containing the KSeF acknowledgement
    // details.
    // In the production environment, KSeF normally returns the official UPO XML
    // response.
    // However, in the sandbox environment the UPO body may sometimes be missing,
    // so this method generates a minimal placeholder UPO for local storage and
    // tracking.
    private String buildUpoXml(KsefInvoice invoice, String ksefId, LocalDateTime timestamp) {
        // ! It's just a small XML saying: "Invoice FV/2026/05/001 was received by KSeF
        // at this time and given this permanent ID."
        // In production, KSeF sends you a real UPO XML with digital signature and more
        // fields.

        // In sandbox (test environment), KSeF does NOT send back a UPO body — the
        // status poll just gives you the ksefReferenceNumber and nothing else.

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                "<UPO xmlns=\"http://crd.gov.pl/wzor/2023/06/29/12648/\">" +
                "<NumerKSeF>" + ksefId + "</NumerKSeF>" + // ! ← KSeF-ID (permanent govt number)
                "<NumerFaktury>" + invoice.getInvoiceNumber() + "</NumerFaktury>" + // ! ← Your invoice number
                "<DataCzasOdbioru>" + timestamp + "</DataCzasOdbioru>" + // ! ← When govt received it
                "<Srodowisko>" + apiProperties.getEnvironment() + "</Srodowisko>" + // ! ← TEST or PRODUCTION
                "</UPO>";
    }

    private LocalDateTime extractTimestamp(String iso, LocalDateTime fallback) {
        if (iso == null || iso.isBlank())
            return fallback;
        try {
            return LocalDateTime.parse(iso, DateTimeFormatter.ISO_DATE_TIME);
        } catch (DateTimeParseException e) {
            return fallback;
        }
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
