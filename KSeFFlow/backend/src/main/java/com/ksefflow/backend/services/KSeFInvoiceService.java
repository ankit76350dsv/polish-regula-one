package com.ksefflow.backend.services;

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
import com.ksefflow.backend.services.ksefauthutils.KsefApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

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
     * Persists a new invoice in DRAFT status.
     * No XML is generated or validated at this stage — the user can still edit the
     * invoice.
     * Duplicate invoice numbers within the same tenant are rejected.
     */
    public KsefInvoice createInvoice(KsefInvoice invoice, String userEmail, String ipAddress) {
        if (ksef_invoices_repository.existsByTenantIdAndInvoiceNumber(
                invoice.getTenantId(), invoice.getInvoiceNumber())) {
            throw new IllegalArgumentException(
                    "Invoice number [" + invoice.getInvoiceNumber() +
                            "] already exists for tenant [" + invoice.getTenantId() + "]");
        }

        invoice.setStatus(KsefInvoiceStatus.DRAFT);
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setKsefEnvironment(apiProperties.getEnvironment());

        KsefInvoice saved = ksef_invoices_repository.save(invoice);

        AuditLog.writeAuditLog(saved.getTenantId(), "INVOICE_CREATED", saved.getId(),
                null, "invoiceNumber=" + saved.getInvoiceNumber(), userEmail, ipAddress);

        log.info("Invoice [{}] created as DRAFT for tenant [{}]", saved.getInvoiceNumber(), saved.getTenantId());

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

    public KsefInvoice submitInvoice(String tenantId, String invoiceId, String nip,
            String userEmail, String ipAddress) {
        // Step 1 — load and guard
        KsefInvoice invoice = loadAndGuardDraft(tenantId, invoiceId);

        // Step 2 — transition to PENDING so the UI shows processing state
        invoice.setStatus(KsefInvoiceStatus.PENDING);
        invoice.setUpdatedAt(LocalDateTime.now());
        invoice.setSubmissionAttempts(invoice.getSubmissionAttempts() + 1);
        ksef_invoices_repository.save(invoice);

        AuditLog.writeAuditLog(tenantId, "INVOICE_SUBMISSION_STARTED", invoiceId, null,
                "attempt=" + invoice.getSubmissionAttempts(), userEmail, ipAddress);

        // Steps 3–4 — generate and strictly validate FA(3) XML
        FA3XmlGeneratorService.FA3XmlResult xmlResult = xmlGeneratorService.generateXml(invoice);
        xmlValidatorService.validateStrict(xmlResult.xmlContent());

        // Persist hash immediately — needed for the offline QR even if submission fails
        invoice.setFa3XmlHash(xmlResult.sha256Hash());
        ksef_invoices_repository.save(invoice);

        // Steps 5–8 — KSeF network pipeline (triggers offline mode on failure)
        try {
            return executeKsefSubmission(invoice, xmlResult.xmlContent(), nip, userEmail, ipAddress);
        } catch (KsefSubmissionException | KsefAuthException e) {
            log.warn("KSeF submission failed for invoice [{}]: {} — switching to OFFLINE_MODE",
                    invoice.getInvoiceNumber(), e.getMessage());
            // ! need to understand this...... for the offline
            return handleOfflineMode(invoice, e.getMessage(), userEmail, ipAddress);
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

    // ── Private: KSeF network pipeline ─────────────────────────────────────────

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
        // TODO: last step of the sending invoce to goverment { Header: SessionToken: 20230615-SE-... | Body: <FA3 XML bytes> }
        KsefSendInvoiceResponse sendResponse = ksefApiClient.sendInvoice(sessionToken, xmlContent);
        String elementRef = sendResponse.getElementReferenceNumber();

        log.info("Invoice [{}] accepted by KSeF — elementRef: [{}]", invoice.getInvoiceNumber(), elementRef);

        // Step 7 — poll for the permanent KSeF reference number + acquisition timestamp.
        // In production this can take a few seconds; the sandbox usually responds immediately.
        KsefPollResult pollResult = pollForKsefId(sessionToken, elementRef, invoice.getInvoiceNumber());
        String ksefId = pollResult.ksefReferenceNumber();
        LocalDateTime receivedAt = LocalDateTime.now();

        // Prefer the government's own acquisitionTimestamp; fall back to sendResponse timestamp,
        // then to the local clock — so the UPO is stamped with the legally correct time.
        LocalDateTime upoTimestamp = extractTimestamp(
                pollResult.acquisitionTimestamp() != null
                        ? pollResult.acquisitionTimestamp()
                        : sendResponse.getTimestamp(),
                receivedAt);

        // Step 8 — fetch the real UPO XML from KSeF (production).
        // In sandbox KSeF does not return a UPO body, so we fall back to the stub.
        //TODO: get the receipt using the sessionToken and ksfid that we get after recpeit not the invoice.
        String upoXml = ksefApiClient.fetchUpoXml(sessionToken, ksefId)
                .orElseGet(() -> buildUpoXml(invoice, ksefId, upoTimestamp));

        String upoDocumentId = upoStorageService.storeUpo(
                invoiceId, tenantId, ksefId, upoXml, upoTimestamp);

        // Step 9 — mark invoice as SENT
        invoice.setStatus(KsefInvoiceStatus.SENT);
        invoice.setKsefId(ksefId); // ! ksefReferenceNumber
        invoice.setUpoDocumentId(upoDocumentId); //! mongodb _id of the invoice
        invoice.setUpoStatus(KsefUpoStatus.RECEIVED);
        invoice.setUpoTimestamp(upoTimestamp); // ! when get the sendinvoice response
        invoice.setSubmittedToKsefAt(submittedAt);
        invoice.setReceivedFromKsefAt(receivedAt); // ! when get ksefReferenceNumber
        invoice.setLastErrorMessage(null);
        invoice.setUpdatedAt(LocalDateTime.now());
        KsefInvoice saved = ksef_invoices_repository.save(invoice);

        AuditLog.writeAuditLog(tenantId, "INVOICE_SENT_TO_KSEF", invoiceId, null,
                "ksefId=" + ksefId + " env=" + apiProperties.getEnvironment(), userEmail, ipAddress);
        log.info("Invoice [{}] successfully registered with KSeF — ksefId: [{}]",
                invoice.getInvoiceNumber(), ksefId);
        return saved;
    }

    // Carries both the permanent KSeF reference number and the government's own
    // acquisition timestamp so the UPO is stamped with the legally correct time.
    private record KsefPollResult(String ksefReferenceNumber, String acquisitionTimestamp) {}

    // Polls GET /online/Invoice/Status until a ksefReferenceNumber is returned.
    // Retries up to 5 times with 1-second gaps — adequate for sandbox + production.
    private KsefPollResult pollForKsefId(String sessionToken, String elementRef, String invoiceNumber) {
        int maxAttempts = 5;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            KsefInvoiceStatusResponse statusResponse =
                    ksefApiClient.getInvoiceStatus(sessionToken, elementRef);

            if (statusResponse.getInvoiceStatus() != null &&
                    statusResponse.getInvoiceStatus().getKsefReferenceNumber() != null) {
                return new KsefPollResult(
                        statusResponse.getInvoiceStatus().getKsefReferenceNumber(),
                        statusResponse.getInvoiceStatus().getAcquisitionTimestamp()
                );
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

        AuditLog.writeAuditLog(invoice.getTenantId(), "INVOICE_OFFLINE_MODE", invoice.getId(),
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
    // Builds a simple fallback UPO XML document containing the KSeF acknowledgement details.
    // In the production environment, KSeF normally returns the official UPO XML response.
    // However, in the sandbox environment the UPO body may sometimes be missing,
    // so this method generates a minimal placeholder UPO for local storage and tracking.
    private String buildUpoXml(KsefInvoice invoice, String ksefId, LocalDateTime timestamp) {
        //! It's just a small XML saying: "Invoice FV/2026/05/001 was received by KSeF at this time and given this permanent ID."
        //In production, KSeF sends you a real UPO XML with digital signature and more fields.

        // In sandbox (test environment), KSeF does NOT send back a UPO body — the status poll just gives you the ksefReferenceNumber and nothing else.

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                "<UPO xmlns=\"http://crd.gov.pl/wzor/2023/06/29/12648/\">" +
                "<NumerKSeF>" + ksefId + "</NumerKSeF>" + //! ← KSeF-ID (permanent govt number)
                "<NumerFaktury>" + invoice.getInvoiceNumber() + "</NumerFaktury>" + //! ← Your invoice number
                "<DataCzasOdbioru>" + timestamp + "</DataCzasOdbioru>" + //! ← When govt received it
                "<Srodowisko>" + apiProperties.getEnvironment() + "</Srodowisko>" + //! ← TEST or PRODUCTION
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
