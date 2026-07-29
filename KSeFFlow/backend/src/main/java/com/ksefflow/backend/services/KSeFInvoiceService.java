package com.ksefflow.backend.services;

import com.ksefflow.backend.services.fa3xml.FA3XmlGeneratorService;
import com.ksefflow.backend.services.fa3xml.Fa3ValidationGate;

import com.ksefflow.backend.services.ksefauth.KSeFAuthService;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.EncryptionInfo;
import com.ksefflow.backend.dto.ksefapi.OpenOnlineSessionRequest;
import com.ksefflow.backend.dto.ksefapi.OpenOnlineSessionResponse;
import com.ksefflow.backend.dto.ksefapi.PublicKeyCertificate;
import com.ksefflow.backend.dto.ksefapi.SendInvoiceRequest;
import com.ksefflow.backend.dto.ksefapi.SendInvoiceResponse;
import com.ksefflow.backend.dto.ksefapi.SessionInvoiceStatusResponse;
import com.ksefflow.backend.services.ksefauth.KsefSessionEncryptionService;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.exceptions.KsefSubmissionException;
import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.notification.HubNotificationPublisher;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.models.utils.KsefOfflineMode;
import com.ksefflow.backend.models.utils.KsefUpoStatus;
import com.ksefflow.backend.repository.KsefInvoiceRepository;
import com.ksefflow.backend.services.ksefauth.KsefApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

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
 * 3. validateXml — Fa3ValidationGate runs the official FA(3) XSD check before submission
 * ONLY when ksef.validation.xsd.enabled=true (off in prod → KSeF validates server-side)
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
 * → KsefQrService generates the two mandatory QR codes (OFFLINE + CERTYFIKAT)
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

    // Used for the flexible list query (optional status + optional text search + pagination),
    // following the same MongoTemplate pattern as KSeFAuditLogService.
    private final MongoTemplate mongoTemplate;

    private final FA3XmlGeneratorService xmlGeneratorService;
    private final Fa3ValidationGate fa3ValidationGate;
    private final KSeFAuthService authService;
    private final KsefApiClient ksefApiClient;
    private final KsefSessionEncryptionService encryptionService;
    private final UPOStorageService upoStorageService;
    private final KsefQrService qrService;
    private final KsefApiProperties apiProperties;
    // Tells us the current KSeF state (online / unavailable / Ministry-declared emergency) so
    // a parked invoice gets the legally correct deadline. See KsefAvailabilityService (C7).
    private final KsefAvailabilityService availabilityService;
    // Publishes problems during the submission pipeline to the centralized notification Hub.
    private final HubNotificationPublisher hubPublisher;
    // Computes the next automatic-retry time shown to the user (shared with the retry job).
    private final com.ksefflow.backend.services.retry.KsefRetryScheduleCalculator retryScheduleCalculator;

    // KSeF 2.0 usage flag identifying the MF public key that wraps the session AES key.
    private static final String SYMMETRIC_KEY_ENCRYPTION_USAGE = "SymmetricKeyEncryption";

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
                log.error("[createInvoice]:1 Invoice number [{}] already exists for tenant [{}] with status [{}] — cannot re-create",
                        invoice.getInvoiceNumber(), invoice.getTenantId(), existing.getStatus());
                throw new IllegalArgumentException(
                        "Invoice number [" + invoice.getInvoiceNumber() +
                                "] already exists for tenant [" + invoice.getTenantId() +
                                "] and is no longer a draft (status " + existing.getStatus() + ")");
            }

            // Still a DRAFT → update it in place. Keep the original id + createdAt,
            // overwrite the editable data with the incoming draft, bump updatedAt.
            log.info("[createInvoice]:2 Invoice [{}] already a DRAFT for tenant [{}] — updating existing draft [{}]",
                    existing.getInvoiceNumber(), existing.getTenantId(), existing.getId());

            invoice.setId(existing.getId());
            invoice.setCreatedAt(existing.getCreatedAt());
            invoice.setUpdatedAt(LocalDateTime.now());
            invoice.setStatus(KsefInvoiceStatus.DRAFT);
            // Preserve the existing status timeline — re-saving a draft is NOT a status change
            // (it stays DRAFT), so we carry the prior history over rather than appending or
            // wiping it (the incoming object was rebuilt from the request and has none).
            invoice.setStatusHistory(existing.getStatusHistory());
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

            log.info("[createInvoice]:3 Invoice [{}] DRAFT updated successfully for tenant [{}]",
                    updated.getInvoiceNumber(), updated.getTenantId());
            return updated;
        }

        // No existing invoice → create a fresh DRAFT and seed the status timeline.
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.recordStatus(KsefInvoiceStatus.DRAFT, "Invoice created as draft", userEmail);
        invoice.setKsefEnvironment(apiProperties.getEnvironment());
        KsefInvoice saved = ksef_invoices_repository.save(invoice);

        log.info("[createInvoice]:4 Writing audit log for invoice creation. Invoice ID [{}]", saved.getId());

        KSeFAuditLogService.writeAuditLog(
                saved.getTenantId(),
                "INVOICE_CREATED",
                saved.getId(),
                null,
                "invoiceNumber=" + saved.getInvoiceNumber(),
                userEmail,
                ipAddress);

        log.info("[createInvoice]:5 Invoice [{}] created successfully as DRAFT for tenant [{}]",
                saved.getInvoiceNumber(), saved.getTenantId());

        return saved;
    }

    //! ── Create a correction (faktura korygująca) ────────────────────────────────

    /**
     * Creates a CORRECTION invoice (FA(3) RodzajFaktury = KOR) for an already-sent invoice.
     *
     * SIMPLE EXPLANATION: if a invoice we already sent to KSeF was wrong, we cannot edit it —
     * KSeF invoices are permanent. Instead we issue a NEW invoice that says "this corrects that
     * one", points back to the original by its KSeF number, and explains why. This method builds
     * that correction as a DRAFT; the normal submit pipeline then sends it like any other invoice.
     *
     * @param originalInvoiceId our id of the invoice being corrected (must be SENT, with a KSeF number)
     * @param correction        the corrected invoice content (built from the request like a normal invoice)
     * @param reason            why the correction is needed (FA(3) PrzyczynaKorekty)
     * @param type              optional KSeF correction type 1/2/3 (FA(3) TypKorekty)
     */
    public KsefInvoice createCorrection(String tenantId, String originalInvoiceId, KsefInvoice correction,
                                        String reason, Integer type, String userEmail, String ipAddress) {
        // The original must exist, belong to this tenant, and already be in KSeF (have a KSeF number).
        KsefInvoice original = getInvoice(tenantId, originalInvoiceId);
        if (original.getStatus() != KsefInvoiceStatus.SENT
                || original.getKsefId() == null || original.getKsefId().isBlank()) {
            throw new IllegalStateException("Only an invoice that is already in KSeF (status SENT with a KSeF number) "
                    + "can be corrected. Invoice [" + originalInvoiceId + "] status=" + original.getStatus());
        }

        // Link the new invoice back to the original and mark it as a correction.
        correction.setCorrection(true);
        correction.setCorrectedInvoiceId(original.getId());
        correction.setCorrectedKsefNumber(original.getKsefId());
        correction.setCorrectedInvoiceNumber(original.getInvoiceNumber());
        correction.setCorrectedIssueDate(original.getIssueDate());
        correction.setCorrectionReason(reason);
        correction.setCorrectionType(type);

        // Persist it as a DRAFT through the normal create path (handles idempotency + audit).
        KsefInvoice saved = createInvoice(correction, userEmail, ipAddress);

        KSeFAuditLogService.writeAuditLog(tenantId, "INVOICE_CORRECTION_CREATED", saved.getId(), null,
                "corrects=" + original.getInvoiceNumber() + " ksefId=" + original.getKsefId()
                        + " reason=" + reason, userEmail, ipAddress);
        log.info("[createCorrection]:1 Correction [{}] created for original [{}] (ksefId [{}]) tenant [{}]",
                saved.getInvoiceNumber(), original.getInvoiceNumber(), original.getKsefId(), tenantId);
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

        log.info("[submitInvoice]:1 Starting invoice submission process. TenantId=[{}], InvoiceId=[{}], NIP=[{}]", tenantId, invoiceId, nip);

        //! Step 1 — Load and validate DRAFT invoice
        KsefInvoice invoice = loadAndGuardDraft(tenantId, invoiceId);

        // ! Step 2 — Move invoice to PENDING state
        int nextAttempt = invoice.getSubmissionAttempts() + 1;
        invoice.setSubmissionAttempts(nextAttempt);
        invoice.recordStatus(KsefInvoiceStatus.PENDING, "Submitted to KSeF (attempt " + nextAttempt + ")", userEmail);

        log.info("[submitInvoice]:2 Submission attempt count updated to [{}] and saving PENDING invoice state into database for invoice [{}]", nextAttempt, invoice.getInvoiceNumber());

        ksef_invoices_repository.save(invoice);

        // Audit log for submission attempt
        log.info("[submitInvoice]:3 Creating audit log entry for invoice submission attempt. InvoiceId=[{}]", invoiceId);

        KSeFAuditLogService.writeAuditLog(tenantId, "INVOICE_SUBMISSION_STARTED", invoiceId, null, "attempt=" + invoice.getSubmissionAttempts(), userEmail, ipAddress);

        // ! Step 3 + 4 — Generate FA(3) XML and validate it against the official schema (when
        // ksef.validation.xsd.enabled). A failure here is a VALIDATION error (bad/missing fields,
        // invalid VAT, malformed XML) — notify the issuer via the Hub, then rethrow so the API
        // still returns the error to the caller.
        FA3XmlGeneratorService.FA3XmlResult xmlResult;
        try {
            xmlResult = xmlGeneratorService.generateXml(invoice);
            fa3ValidationGate.validateBeforeSubmission(xmlResult.xmlContent());
        } catch (KsefXmlGenerationException e) {
            hubPublisher.publishInvoiceEvent("INVOICE_VALIDATION_ERROR", tenantId,
                    "Invoice failed validation",
                    "Invoice " + invoice.getInvoiceNumber() + " did not pass FA(3) validation: " + e.getMessage(),
                    invoiceId, "INVOICE_VALIDATION_ERROR:" + invoiceId + ":" + nextAttempt);
            throw e;
        }
        // Save XML hash
        invoice.setFa3XmlHash(xmlResult.sha256Hash());
        ksef_invoices_repository.save(invoice);

        // ! Government rule — special modes must NOT use the online submission flow.
        // The Ministry of Finance KSeF 2.0 rules say that during a declared EMERGENCY ("tryb
        // awaryjny") or UNAVAILABILITY ("niedostępność") invoices are issued OFFLINE (FA(3) + QR
        // code) and only later transmitted to KSeF — within the next business day, or within
        // 7 business days for an emergency. So when KSeF is NOT in the ONLINE state we do not even
        // attempt the live call; we route the invoice straight to offline issuance. The legal
        // deadline, QR sealing and the background retry queue are all handled by handleOfflineMode.
        // (Sources: ksef.podatki.gov.pl — "Tryby szczególne wystawiania faktur" / "Tryb offline".)
        if (!availabilityService.isOnline()) {
            KsefAvailabilityService.Status state = availabilityService.getStatus();
            KsefOfflineMode offlineMode = availabilityService.currentOfflineMode();
            String reason = "KSeF is in " + state.mode() + " mode (" + state.reason()
                    + ") — invoice issued offline per the declared state";
            log.warn("[submitInvoice]:3b KSeF not ONLINE (mode={}) — skipping the online flow and "
                    + "issuing invoice [{}] offline. Reason=[{}]",
                    state.mode(), invoice.getInvoiceNumber(), state.reason());
            return handleOfflineMode(invoice, offlineMode, reason, userEmail, ipAddress);
        }

        // Step 5–8 — Submit invoice to KSeF
        try {

            KsefInvoice submittedInvoice = executeKsefSubmission(invoice, xmlResult.xmlContent(), nip, userEmail, ipAddress);
            log.info("[submitInvoice]:4 Invoice [{}] submitted successfully to KSeF", invoice.getInvoiceNumber());

            // Notify the issuer of the successful direct submission. (Retry-queue successes are
            // notified separately by KsefRetryQueueService, so this covers the DIRECT path only.)
            hubPublisher.publishInvoiceEvent("INVOICE_SENT", tenantId,
                    "Invoice accepted by KSeF",
                    "Invoice " + submittedInvoice.getInvoiceNumber() + " was submitted successfully (ksefId "
                            + submittedInvoice.getKsefId() + ").",
                    invoiceId, "INVOICE_SENT:" + invoiceId);

            return submittedInvoice;

        } catch (KsefSubmissionException | KsefAuthException e) {

            // KSeF was reachable-but-rejected or unreachable at the session/network layer →
            // park the invoice offline. The MODE (and therefore the legal deadline) comes from
            // the availability monitor: EMERGENCY (7 business days) when the Ministry has
            // declared "tryb awaryjny", otherwise OFFLINE_UNAVAILABILITY (next business day).
            KsefOfflineMode mode = availabilityService.currentOfflineMode();
            log.warn("[submitInvoice]:5 KSeF submission failed for invoice [{}]. Reason=[{}]. Switching to OFFLINE_MODE (mode={})",
                    invoice.getInvoiceNumber(), e.getMessage(), mode);

            // Notify the issuer that this submission could not reach KSeF and was parked offline
            // (the background retry queue will keep trying until the legal deadline).
            hubPublisher.publishInvoiceEvent("INVOICE_SUBMISSION_FAILED", tenantId,
                    "Invoice could not be sent to KSeF",
                    "Invoice " + invoice.getInvoiceNumber() + " could not be submitted ("
                            + e.getMessage() + ") and was queued offline for automatic retry.",
                    invoiceId, "INVOICE_SUBMISSION_FAILED:" + invoiceId + ":" + nextAttempt);

            return handleOfflineMode(invoice, mode, e.getMessage(), userEmail, ipAddress);
        }
    }

    //! ── Manual retry of an offline invoice (user-triggered from the Offline Queue UI) ──

    /**
     * Retry NOW an invoice that is parked OFFLINE_MODE (or already RETRYING), instead of waiting
     * for the scheduled background job. Really re-attempts the KSeF submission and notifies the
     * outcome to the Hub. Returns the updated invoice (SENT on success, else still OFFLINE_MODE).
     */
    public KsefInvoice retryOfflineInvoice(String tenantId, String invoiceId, String userEmail, String ipAddress) {
        KsefInvoice invoice = getInvoice(tenantId, invoiceId);
        if (invoice.getStatus() != KsefInvoiceStatus.OFFLINE_MODE
                && invoice.getStatus() != KsefInvoiceStatus.RETRYING) {
            throw new IllegalStateException("Invoice [" + invoiceId
                    + "] is not awaiting retry (status " + invoice.getStatus() + ")");
        }

        KsefInvoice result = resubmitOffline(invoice, userEmail, ipAddress);

        if (result.getStatus() == KsefInvoiceStatus.SENT) {
            hubPublisher.publishInvoiceEvent("INVOICE_SENT", result.getTenantId(),
                    "Invoice accepted by KSeF",
                    "Invoice " + result.getInvoiceNumber() + " was sent to KSeF (ksefId "
                            + result.getKsefId() + ") on a manual retry.",
                    result.getId(), "INVOICE_SENT:" + result.getId());
        } else {
            hubPublisher.publishInvoiceEvent("INVOICE_SUBMISSION_FAILED", result.getTenantId(),
                    "Invoice still could not be sent to KSeF",
                    "Manual retry of invoice " + result.getInvoiceNumber() + " failed ("
                            + result.getLastErrorMessage() + "). It remains queued.",
                    result.getId(), "INVOICE_RETRY_ATTEMPT_FAILED:" + result.getId() + ":" + result.getSubmissionAttempts());
        }
        return result;
    }

    //! ── Retry an offline-parked invoice ─────────────────────────────────────────

    /**
     * Re-attempts KSeF submission for an invoice that is parked OFFLINE_MODE (or already
     * RETRYING). Called by the background retry scheduler (KsefRetryQueueService), NOT by a
     * user request — so it derives everything it needs from the stored invoice itself:
     *   - the issuer NIP comes from the invoice's sellerNip (the company that issued it);
     *   - the FA(3) XML is regenerated from the stored invoice fields (deterministic), so we
     *     always send exactly what the invoice currently says.
     *
     * IMPORTANT (legal): this method does NOT change offlineIssuedAt or the original
     * ksefSubmissionDeadline. handleOfflineMode() sets offlineIssuedAt only once and always
     * recomputes the deadline from that same first moment, so retrying never extends the legal
     * window. On success the invoice becomes SENT and the offline fields are RETAINED for audit.
     *
     * @return the invoice after the attempt: SENT on success, or back in OFFLINE_MODE on failure.
     */
    public KsefInvoice resubmitOffline(KsefInvoice invoice, String userEmail, String ipAddress) {
        String tenantId = invoice.getTenantId();
        String invoiceId = invoice.getId();

        // Only invoices that are waiting offline (or mid-retry) can be retried here.
        if (invoice.getStatus() != KsefInvoiceStatus.OFFLINE_MODE
                && invoice.getStatus() != KsefInvoiceStatus.RETRYING) {
            throw new IllegalStateException("Invoice [" + invoiceId + "] is not retryable (status "
                    + invoice.getStatus() + ")");
        }

        LocalDateTime now = LocalDateTime.now();
        int nextAttempt = invoice.getSubmissionAttempts() + 1;
        invoice.setSubmissionAttempts(nextAttempt);
        invoice.setLastRetryAt(now);
        invoice.recordStatus(KsefInvoiceStatus.RETRYING, "Automatic retry attempt " + nextAttempt, userEmail);
        ksef_invoices_repository.save(invoice);

        KSeFAuditLogService.writeAuditLog(tenantId, "INVOICE_RETRY_STARTED", invoiceId, null,
                "attempt=" + nextAttempt + " deadline=" + invoice.getKsefSubmissionDeadline(),
                userEmail, ipAddress);

        log.info("[resubmitOffline]:1 Retry attempt [{}] for offline invoice [{}] (tenant [{}], deadline [{}])",
                nextAttempt, invoice.getInvoiceNumber(), tenantId, invoice.getKsefSubmissionDeadline());

        // Regenerate the FA(3) XML from the stored invoice and re-validate before sending.
        FA3XmlGeneratorService.FA3XmlResult xmlResult = xmlGeneratorService.generateXml(invoice);
        fa3ValidationGate.validateBeforeSubmission(xmlResult.xmlContent());
        invoice.setFa3XmlHash(xmlResult.sha256Hash());

        try {
            KsefInvoice sent = executeKsefSubmission(invoice, xmlResult.xmlContent(),
                    invoice.getSellerNip(), userEmail, ipAddress);
            log.info("[resubmitOffline]:2 Offline invoice [{}] successfully submitted to KSeF on retry [{}]",
                    invoice.getInvoiceNumber(), nextAttempt);
            return sent;
        } catch (KsefSubmissionException | KsefAuthException e) {
            // Still cannot reach / be accepted by KSeF → re-park OFFLINE, keeping the SAME mode
            // (do not downgrade a Ministry-declared emergency to a generic unavailability) and
            // the SAME original deadline (handleOfflineMode preserves offlineIssuedAt).
            KsefOfflineMode mode = invoice.getOfflineMode() != null
                    ? invoice.getOfflineMode()
                    : KsefOfflineMode.OFFLINE_UNAVAILABILITY;
            log.warn("[resubmitOffline]:3 Retry [{}] failed for invoice [{}]: {} — staying OFFLINE (mode={})",
                    nextAttempt, invoice.getInvoiceNumber(), e.getMessage(), mode);
            return handleOfflineMode(invoice, mode, e.getMessage(), userEmail, ipAddress);
        }
    }

    // ── Read ───────────────────────────────────────────────────────────────────

    public KsefInvoice getInvoice(String tenantId, String invoiceId) {
        log.info("[getInvoice]:1 Loading invoice [{}] for tenant [{}]", invoiceId, tenantId);
        KsefInvoice invoice = ksef_invoices_repository.findById(invoiceId)
                .filter(inv -> tenantId.equals(inv.getTenantId()))
                .filter(inv -> !inv.isSoftDeleted())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Invoice [" + invoiceId + "] not found for tenant [" + tenantId + "]"));
        applyNextRetryAt(invoice);
        return invoice;
    }

    /**
     * Generates the official FA(3) XML for one invoice — the EXACT document the KSeF submission
     * pipeline produces (same FA3XmlGeneratorService / schema), so the UI can preview/download the
     * real thing instead of a hand-rolled approximation. Tenant-scoped via getInvoice().
     */
    public String generateInvoiceXml(String tenantId, String invoiceId) {
        KsefInvoice invoice = getInvoice(tenantId, invoiceId);
        return xmlGeneratorService.generateXml(invoice).xmlContent();
    }

    /**
     * Server-side paginated list of a tenant's invoices, with an optional status filter and an
     * optional text search (matches invoice number, buyer name, or buyer NIP — case-insensitive).
     * Always newest-first. Built with MongoTemplate so every filter is optional and combined in
     * ONE query, and the database does the paging (no loading everything into memory).
     *
     * @param tenantId the tenant (always applied — tenant isolation)
     * @param status   optional status filter (null = any status)
     * @param search   optional text to look for in invoice number / buyer name / buyer NIP
     * @param pageable the page number and size (sort is forced to createdAt DESC)
     */
    public Page<KsefInvoice> listInvoices(String tenantId, KsefInvoiceStatus status, String search, Pageable pageable) {
        log.info("[listInvoices]:1 Listing invoices for tenant [{}] status [{}] search [{}] page [{}] size [{}]",
                tenantId, status, search, pageable.getPageNumber(), pageable.getPageSize());

        // Build the filter: tenant is mandatory; status and search are added only if provided.
        List<Criteria> filters = new ArrayList<>();
        filters.add(Criteria.where("tenantId").is(tenantId));
        if (status != null) {
            filters.add(Criteria.where("status").is(status));
        }
        if (search != null && !search.isBlank()) {
            // Quote the user input so characters like "." are treated literally, not as regex.
            String safe = java.util.regex.Pattern.quote(search.trim());
            filters.add(new Criteria().orOperator(
                    Criteria.where("invoiceNumber").regex(safe, "i"),
                    Criteria.where("buyerName").regex(safe, "i"),
                    Criteria.where("buyerNip").regex(safe, "i")));
        }
        Criteria finalCriteria = new Criteria().andOperator(filters.toArray(new Criteria[0]));

        // Count first (for the total page count), then fetch just the requested page, newest first.
        long total = mongoTemplate.count(new Query(finalCriteria), KsefInvoice.class);
        Query dataQuery = new Query(finalCriteria)
                .with(Sort.by(Sort.Direction.DESC, "createdAt"))
                .skip((long) pageable.getPageNumber() * pageable.getPageSize())
                .limit(pageable.getPageSize());
        List<KsefInvoice> content = mongoTemplate.find(dataQuery, KsefInvoice.class);

        content.forEach(this::applyNextRetryAt);
        return new PageImpl<>(content, pageable, total);
    }

    // For invoices still awaiting KSeF (offline/retrying), compute the earliest time the
    // automatic retry job will next try to send them, so the UI can show the real time.
    private void applyNextRetryAt(KsefInvoice invoice) {
        if (invoice.getStatus() == KsefInvoiceStatus.OFFLINE_MODE
                || invoice.getStatus() == KsefInvoiceStatus.RETRYING) {
            invoice.setNextRetryAt(retryScheduleCalculator.nextEligibleAt(invoice));
        }
    }

    // ! ── Private: KSeF network pipeline ─────────────────────────────────────────

    private KsefInvoice executeKsefSubmission(KsefInvoice invoice,
            String xmlContent, String nip,
            String userEmail, String ipAddress) {

        log.info("[executeKsefSubmission]:1 Starting KSeF 2.0 invoice submission flow for invoice [{}]",
                invoice.getInvoiceNumber());

        String tenantId = invoice.getTenantId();
        String invoiceId = invoice.getId();

        // Step 5 — acquire a KSeF 2.0 accessToken (reuse / refresh / full XAdES auth).
        String accessToken = authService.openSession(tenantId, nip);
        log.debug("[executeKsefSubmission]:2 accessToken acquired for tenant [{}]", tenantId);

        // Step 6 — fetch the MF public key and open an encrypted online session.
        PublicKeyCertificate symmetricKeyCert = resolveSymmetricKeyCertificate();
        KsefSessionEncryptionService.SessionKey sessionKey = encryptionService.generateSessionKey();
        EncryptionInfo encryption = encryptionService.buildEncryptionInfo(
                sessionKey, symmetricKeyCert.certificate(), symmetricKeyCert.publicKeyId());

        OpenOnlineSessionResponse session = ksefApiClient.openOnlineSession(accessToken,
                new OpenOnlineSessionRequest(apiProperties.toFormCode(), encryption));
        String sessionRef = session.referenceNumber();
        log.info("[executeKsefSubmission]:3 Online session [{}] opened for invoice [{}]",
                sessionRef, invoice.getInvoiceNumber());

        LocalDateTime submittedAt = LocalDateTime.now();

        // Step 7 — encrypt the FA(3) XML with the session key and send it.
        KsefSessionEncryptionService.EncryptedInvoice enc = encryptionService.encryptInvoice(
                xmlContent.getBytes(java.nio.charset.StandardCharsets.UTF_8), sessionKey);
        SendInvoiceResponse sendResponse = ksefApiClient.sendInvoice(accessToken, sessionRef,
                new SendInvoiceRequest(
                        enc.invoiceHashB64(), enc.invoiceSize(),
                        enc.encryptedInvoiceHashB64(), enc.encryptedInvoiceSize(),
                        java.util.Base64.getEncoder().encodeToString(enc.cipherBytes()),
                        Boolean.FALSE));
        String invoiceRef = sendResponse.referenceNumber();
        log.info("[executeKsefSubmission]:4 Invoice [{}] accepted into session — invoiceRef [{}]",
                invoice.getInvoiceNumber(), invoiceRef);

        // Step 8 — poll the per-invoice status until KSeF assigns the permanent KSeF number.
        KsefPollResult pollResult = pollForKsefId(accessToken, sessionRef, invoiceRef, invoice.getInvoiceNumber());
        String ksefId = pollResult.ksefReferenceNumber();
        LocalDateTime receivedAt = LocalDateTime.now();
        log.info("[executeKsefSubmission]:5 Permanent KSeF number received for invoice [{}] — ksefId [{}]",
                invoice.getInvoiceNumber(), ksefId);

        // Prefer KSeF's own acquisition timestamp; fall back to the local clock.
        LocalDateTime upoTimestamp = extractTimestamp(pollResult.acquisitionTimestamp(), receivedAt);

        // Step 9 — fetch the official per-invoice UPO XML from KSeF.
        String upoXml = ksefApiClient.fetchUpoXml(accessToken, sessionRef, invoiceRef)
                .orElseGet(() -> {
                    log.warn("[executeKsefSubmission]:6 KSeF did not return UPO XML yet — storing placeholder for invoice [{}]",
                            invoice.getInvoiceNumber());
                    return buildUpoPlaceholder(invoice, ksefId, upoTimestamp);
                });
        String upoDocumentId = upoStorageService.storeUpo(invoiceId, tenantId, ksefId, upoXml, upoTimestamp);

        // Step 10 — close the online session (best-effort; it also expires on its own).
        ksefApiClient.closeOnlineSession(accessToken, sessionRef);

        // Step 9 — mark invoice as SENT
        //! invoce update...
        log.info("[executeKsefSubmission]:7 Updating invoice status to SENT for invoice [{}]",
                invoice.getInvoiceNumber());
        invoice.recordStatus(KsefInvoiceStatus.SENT, "Accepted by KSeF (ksefId " + ksefId + ")", userEmail);
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
            invoice.setQrCodeInvoice(qrService.generateInvoiceCode(invoice));
        } catch (Exception qrEx) {
            // Never fail a successful KSeF submission because of QR generation.
            log.warn("[executeKsefSubmission]:8 CODE I generation failed for SENT invoice [{}]: {}",
                    invoice.getInvoiceNumber(), qrEx.getMessage());
        }

        invoice.setUpdatedAt(LocalDateTime.now());
        log.info("[executeKsefSubmission]:9 Saving updated invoice state into database for invoice [{}]",
                invoice.getInvoiceNumber());

        KsefInvoice saved = ksef_invoices_repository.save(invoice);
        KSeFAuditLogService.writeAuditLog(tenantId, "INVOICE_SENT_TO_KSEF", invoiceId, null, "ksefId=" + ksefId + " env=" + apiProperties.getEnvironment(), userEmail, ipAddress);
        log.info("[executeKsefSubmission]:10 Invoice [{}] successfully registered with KSeF and submission flow completed — ksefId: [{}]", invoice.getInvoiceNumber(), ksefId);
        return saved;
    }

    // Carries both the permanent KSeF number and KSeF's own acquisition timestamp so the
    // UPO is stamped with the legally correct time.
    private record KsefPollResult(String ksefReferenceNumber, String acquisitionTimestamp) {
    }

    // Picks the MF public-key certificate whose usage allows wrapping the session AES key.
    private PublicKeyCertificate resolveSymmetricKeyCertificate() {
        log.info("[resolveSymmetricKeyCertificate]:1 Selecting MF public key with usage [{}]",
                SYMMETRIC_KEY_ENCRYPTION_USAGE);
        return ksefApiClient.getPublicKeyCertificates().stream()
                .filter(c -> c.usage() != null && c.usage().contains(SYMMETRIC_KEY_ENCRYPTION_USAGE))
                .findFirst()
                .orElseThrow(() -> new KsefSubmissionException(
                        "No KSeF public key with usage '" + SYMMETRIC_KEY_ENCRYPTION_USAGE + "' available"));
    }

    // Polls GET /sessions/{ref}/invoices/{invoiceRef} until KSeF assigns the permanent
    // KSeF number. Retries with short gaps — adequate for sandbox + production.
    private KsefPollResult pollForKsefId(String accessToken, String sessionRef, String invoiceRef,
                                         String invoiceNumber) {
        int maxAttempts = 5;
        log.info("[pollForKsefId]:1 Polling KSeF status for invoice [{}] (invoiceRef [{}])", invoiceNumber, invoiceRef);

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            SessionInvoiceStatusResponse status = ksefApiClient.getInvoiceStatus(accessToken, sessionRef, invoiceRef);

            if (status.ksefNumber() != null && !status.ksefNumber().isBlank()) {
                log.info("[pollForKsefId]:2 KSeF number assigned for invoice [{}] — [{}]", invoiceNumber, status.ksefNumber());
                return new KsefPollResult(status.ksefNumber(), status.acquisitionDate());
            }
            // A terminal failure status (4xx code) means KSeF rejected the invoice — stop early.
            if (status.status() != null && status.status().code() != null && status.status().code() >= 400) {
                throw new KsefSubmissionException("KSeF rejected invoice [" + invoiceNumber + "] (code "
                        + status.status().code() + "): "
                        + (status.status().description() != null ? status.status().description() : ""));
            }
            if (attempt < maxAttempts) {
                sleepQuietly(1000);
            }
        }

        log.error("[pollForKsefId]:3 KSeF did not assign a number after [{}] attempts for invoice [{}]", maxAttempts, invoiceNumber);
        throw new KsefSubmissionException("KSeF did not assign a number after " + maxAttempts
                + " polling attempts for invoiceRef: " + invoiceRef);
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
            String codeCertificate = qrService.generateCertificateCode(invoice); // CODE II "CERTYFIKAT"
            String codeOffline     = qrService.generateInvoiceCode(invoice);     // CODE I  "OFFLINE"
            invoice.setQrCodeInvoice(codeOffline);
            invoice.setQrCodeCertificate(codeCertificate);
            log.info("[handleOfflineMode]:1 Offline QR codes generated for invoice [{}] (mode={})",
                    invoice.getInvoiceNumber(), mode);
        } catch (KsefCertificateException ce) {
            // No OFFLINE-type KSeF certificate → a compliant offline invoice cannot be issued.
            invoice.setQrCodeInvoice(null);
            invoice.setQrCodeCertificate(null);
            complianceNote = "OFFLINE_CERT_REQUIRED: " + ce.getMessage();
            log.error("[handleOfflineMode]:2 COMPLIANCE BLOCK for invoice [{}] — {}",
                    invoice.getInvoiceNumber(), ce.getMessage());
        } catch (Exception qrEx) {
            invoice.setQrCodeInvoice(null);
            invoice.setQrCodeCertificate(null);
            complianceNote = "QR_GENERATION_FAILED: " + qrEx.getMessage();
            log.error("[handleOfflineMode]:3 Failed to generate offline QR codes for invoice [{}]: {}",
                    invoice.getInvoiceNumber(), qrEx.getMessage(), qrEx);
        }

        invoice.setLastErrorMessage(complianceNote != null ? errorMessage + " | " + complianceNote : errorMessage);
        invoice.setLastRetryAt(now);
        invoice.recordStatus(KsefInvoiceStatus.OFFLINE_MODE,
                "KSeF unavailable — queued offline (deadline " + invoice.getKsefSubmissionDeadline() + ")", userEmail);
        KsefInvoice saved = ksef_invoices_repository.save(invoice);

        KSeFAuditLogService.writeAuditLog(invoice.getTenantId(), "INVOICE_OFFLINE_MODE", invoice.getId(),
                null,
                "mode=" + mode + " deadline=" + invoice.getKsefSubmissionDeadline() + " reason=" + errorMessage,
                userEmail, ipAddress);

        log.warn("[handleOfflineMode]:4 Invoice [{}] parked OFFLINE (mode={}) — MUST reach KSeF by [{}]",
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
        log.info("[loadAndGuardDraft]:1 Loading + guarding DRAFT invoice [{}] for tenant [{}]", invoiceId, tenantId);
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

    // Builds a NON-official placeholder used only when KSeF has not yet returned the real
    // per-invoice UPO (e.g. the UPO is still being generated, or in sandbox). It deliberately
    // does NOT use any government FA/UPO namespace — it must never be mistaken for the legal
    // UPO. The real signed UPO is fetched from GET /sessions/{ref}/invoices/{invoiceRef}/upo
    // and overwrites this once available.
    private String buildUpoPlaceholder(KsefInvoice invoice, String ksefId, LocalDateTime timestamp) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                "<UpoPlaceholder generatedBy=\"KSeFFlow\" official=\"false\">" +
                "<KsefNumber>" + ksefId + "</KsefNumber>" +
                "<InvoiceNumber>" + invoice.getInvoiceNumber() + "</InvoiceNumber>" +
                "<AcquisitionTime>" + timestamp + "</AcquisitionTime>" +
                "<Environment>" + apiProperties.getEnvironment() + "</Environment>" +
                "</UpoPlaceholder>";
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
