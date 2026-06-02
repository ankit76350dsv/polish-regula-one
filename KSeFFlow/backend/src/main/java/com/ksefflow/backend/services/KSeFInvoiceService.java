package com.ksefflow.backend.services;

import com.ksefflow.backend.services.fa3xml.FA3XmlGeneratorService;
import com.ksefflow.backend.services.fa3xml.FA3XmlValidatorService;

import com.ksefflow.backend.services.ksefauth.KSeFAuthService;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.KsefInvoiceStatusResponse;
import com.ksefflow.backend.dto.ksefapi.KsefSendInvoiceResponse;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.exceptions.KsefSubmissionException;
import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.models.utils.KsefUpoStatus;
import com.ksefflow.backend.repository.KsefInvoiceRepository;
import com.ksefflow.backend.services.ksefauth.KsefApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

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
 * → OfflinePdfService generates PDF + QR code
 * → invoice set to OFFLINE_MODE with lastErrorMessage
 * → RetryQueueService (Phase 5) picks it up and retries with exponential
 * backoff
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
    private final OfflinePdfService offlinePdfService;
    private final KsefApiProperties apiProperties;

    // ── Create ─────────────────────────────────────────────────────────────────

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

    // ── Submit Pipeline ────────────────────────────────────────────────────────

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
    //!----------------------------------
    public KsefInvoice submitInvoice(String tenantId, String invoiceId, String nip,
            String userEmail, String ipAddress) {

        log.info("[SUBMITINVOICE] Starting invoice submission process. TenantId=[{}], InvoiceId=[{}], NIP=[{}]", tenantId, invoiceId, nip);

        // Step 1 — Load and validate DRAFT invoice
        KsefInvoice invoice = loadAndGuardDraft(tenantId, invoiceId);

        //! Step 2 — Move invoice to PENDING state
        invoice.setStatus(KsefInvoiceStatus.PENDING);
        invoice.setUpdatedAt(LocalDateTime.now());
        int nextAttempt = invoice.getSubmissionAttempts() + 1;
        invoice.setSubmissionAttempts(nextAttempt);
        log.info("[SUBMITINVOICE] Submission attempt count updated to [{}] for invoice [{}]", nextAttempt, invoice.getInvoiceNumber());
        ksef_invoices_repository.save(invoice);
        // Audit log for submission attempt
        KSeFAuditLogService.writeAuditLog(tenantId,"INVOICE_SUBMISSION_STARTED", invoiceId, null, "attempt=" + invoice.getSubmissionAttempts(), userEmail, ipAddress);

        
        //! Step 3 — Generate FA(3) XML
        //! return two thiing XML and hashof XML
        FA3XmlGeneratorService.FA3XmlResult xmlResult = xmlGeneratorService.generateXml(invoice);

        // Step 4 — Validate XML
        xmlValidatorService.validateStrict(xmlResult.xmlContent());

        // Save XML hash
        log.info("Saving XML SHA-256 hash for invoice [{}]", invoice.getInvoiceNumber());
        invoice.setFa3XmlHash(xmlResult.sha256Hash());
        ksef_invoices_repository.save(invoice);

        // Step 5–8 — Submit invoice to KSeF
        try {

            KsefInvoice submittedInvoice = executeKsefSubmission(
                    invoice,
                    xmlResult.xmlContent(),
                    nip,
                    userEmail,
                    ipAddress);

            log.info("Invoice [{}] submitted successfully to KSeF", invoice.getInvoiceNumber());

            return submittedInvoice;

        } catch (KsefSubmissionException | KsefAuthException e) {

            log.warn("KSeF submission failed for invoice [{}]. Reason=[{}]. Switching to OFFLINE_MODE", invoice.getInvoiceNumber(), e.getMessage());

            log.info("Handling offline mode for invoice [{}]", invoice.getInvoiceNumber());

            return handleOfflineMode(
                    invoice,
                    e.getMessage(),
                    userEmail,
                    ipAddress);
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

    //! ── Private: KSeF network pipeline ─────────────────────────────────────────

    private KsefInvoice executeKsefSubmission(KsefInvoice invoice,
            String xmlContent, String nip,
            String userEmail, String ipAddress) {
        String tenantId = invoice.getTenantId();
        String invoiceId = invoice.getId();

        // Step 5 — open / reuse KSeF government session
        // TODO: 1st step to get {Header: SessionToken: 20230615-SE-...}
        String sessionToken = authService.openSession(tenantId, nip);

        // Step 6 — POST the FA(3) XML to KSeF
        LocalDateTime submittedAt = LocalDateTime.now();
        // TODO: last step of the sending invoce to goverment { Header: SessionToken:
        // 20230615-SE-... | Body: <FA3 XML bytes> }
        KsefSendInvoiceResponse sendResponse = ksefApiClient.sendInvoice(sessionToken, xmlContent);
        String elementRef = sendResponse.getElementReferenceNumber();

        log.info("Invoice [{}] accepted by KSeF — elementRef: [{}]", invoice.getInvoiceNumber(), elementRef);

        // Step 7 — poll for the permanent KSeF reference number + acquisition
        // timestamp.
        // In production this can take a few seconds; the sandbox usually responds
        // immediately.
        KsefPollResult pollResult = pollForKsefId(sessionToken, elementRef, invoice.getInvoiceNumber());
        String ksefId = pollResult.ksefReferenceNumber();
        LocalDateTime receivedAt = LocalDateTime.now();

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
        // recpeit not the invoice.
        String upoXml = ksefApiClient.fetchUpoXml(sessionToken, ksefId)
                .orElseGet(() -> buildUpoXml(invoice, ksefId, upoTimestamp));

        String upoDocumentId = upoStorageService.storeUpo(
                invoiceId, tenantId, ksefId, upoXml, upoTimestamp);

        // Step 9 — mark invoice as SENT
        invoice.setStatus(KsefInvoiceStatus.SENT);
        invoice.setKsefId(ksefId); // ! ksefReferenceNumber
        invoice.setUpoDocumentId(upoDocumentId); // ! mongodb _id of the invoice
        invoice.setUpoStatus(KsefUpoStatus.RECEIVED);
        invoice.setUpoTimestamp(upoTimestamp); // ! when get the sendinvoice response
        invoice.setSubmittedToKsefAt(submittedAt);
        invoice.setReceivedFromKsefAt(receivedAt); // ! when get ksefReferenceNumber
        invoice.setLastErrorMessage(null);
        invoice.setUpdatedAt(LocalDateTime.now());
        KsefInvoice saved = ksef_invoices_repository.save(invoice);

        KSeFAuditLogService.writeAuditLog(tenantId, "INVOICE_SENT_TO_KSEF", invoiceId, null,
                "ksefId=" + ksefId + " env=" + apiProperties.getEnvironment(), userEmail, ipAddress);
        log.info("Invoice [{}] successfully registered with KSeF — ksefId: [{}]",
                invoice.getInvoiceNumber(), ksefId);
        return saved;
    }

    // Carries both the permanent KSeF reference number and the government's own
    // acquisition timestamp so the UPO is stamped with the legally correct time.
    private record KsefPollResult(String ksefReferenceNumber, String acquisitionTimestamp) {
    }

    // Polls GET /online/Invoice/Status until a ksefReferenceNumber is returned.
    // Retries up to 5 times with 1-second gaps — adequate for sandbox + production.
    private KsefPollResult pollForKsefId(String sessionToken, String elementRef, String invoiceNumber) {
        int maxAttempts = 5;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            KsefInvoiceStatusResponse statusResponse = ksefApiClient.getInvoiceStatus(sessionToken, elementRef);

            if (statusResponse.getInvoiceStatus() != null &&
                    statusResponse.getInvoiceStatus().getKsefReferenceNumber() != null) {
                return new KsefPollResult(
                        statusResponse.getInvoiceStatus().getKsefReferenceNumber(),
                        statusResponse.getInvoiceStatus().getAcquisitionTimestamp());
            }

            if (attempt < maxAttempts) {
                log.debug("KSeF has not yet assigned reference for invoice [{}] — " +
                        "attempt {}/{}, retrying in 1s", invoiceNumber, attempt, maxAttempts);
                sleepQuietly(1000);
            }
        }
        throw new KsefSubmissionException(
                "KSeF did not assign a reference number after " + maxAttempts +
                        " polling attempts for elementRef: " + elementRef);
    }

    // ── Private: offline fallback ──────────────────────────────────────────────

    private KsefInvoice handleOfflineMode(KsefInvoice invoice, String errorMessage,
            String userEmail, String ipAddress) {
        try {
            // Generate offline PDF + QR (does not throw on failure — logged only)
            offlinePdfService.generateOfflinePdf(invoice);
            String qrUrl = offlinePdfService.verificationUrl(invoice);
            invoice.setOfflineQrCode(qrUrl);
            log.info("Offline PDF generated for invoice [{}] — QR: {}", invoice.getInvoiceNumber(), qrUrl);
        } catch (Exception pdfEx) {
            log.error("Offline PDF generation also failed for invoice [{}]: {}",
                    invoice.getInvoiceNumber(), pdfEx.getMessage());
        }

        invoice.setStatus(KsefInvoiceStatus.OFFLINE_MODE);
        invoice.setLastErrorMessage(errorMessage);
        invoice.setLastRetryAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        KsefInvoice saved = ksef_invoices_repository.save(invoice);

        KSeFAuditLogService.writeAuditLog(invoice.getTenantId(), "INVOICE_OFFLINE_MODE", invoice.getId(),
                null, "reason=" + errorMessage, userEmail, ipAddress);
        return saved;
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
