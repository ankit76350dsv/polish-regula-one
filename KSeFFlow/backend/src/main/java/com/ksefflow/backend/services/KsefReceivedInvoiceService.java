package com.ksefflow.backend.services;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.QueryInvoicesMetadataRequest;
import com.ksefflow.backend.dto.ksefapi.QueryInvoicesMetadataResponse;
import com.ksefflow.backend.dto.ksefapi.QueryInvoicesMetadataResponse.InvoiceMetadata;
import com.ksefflow.backend.models.KsefReceivedInvoice;
import com.ksefflow.backend.repository.KsefReceivedInvoiceRepository;
import com.ksefflow.backend.services.certificate.CertificateCryptoUtils;
import com.ksefflow.backend.services.ksefauth.KSeFAuthService;
import com.ksefflow.backend.services.ksefauth.KsefApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;

/**
 * KsefReceivedInvoiceService — receiving purchase invoices (faktury otrzymane), gap C1.
 *
 * SIMPLE EXPLANATION (why this exists):
 * KSeF is two-way. As well as SENDING the invoices we issue, the law (from 1 Feb 2026) requires
 * every taxpayer to be able to RECEIVE the invoices that other companies issue to them — there
 * is no "accept" step, an invoice counts as received the moment KSeF gives it a number. This
 * service pulls those purchase invoices down from KSeF so the tenant can see and keep them.
 *
 * Two jobs:
 *   1. sync()  — ask KSeF "list the invoices issued TO me in this date window" (subjectType
 *                "Subject2" = buyer) and save the metadata locally, skipping anything we already
 *                have. KSeF limits each query to a 3-month window.
 *   2. getXml()— fetch the full invoice XML for one invoice on demand, store it encrypted, and
 *                return it.
 *
 * Official references: KSeF 2.0 manual part II "Wystawianie i otrzymywanie faktur"; endpoints
 * POST /invoices/query/metadata and GET /invoices/ksef/{ksefNumber}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KsefReceivedInvoiceService {

    private final KSeFAuthService authService;
    private final KsefApiClient ksefApiClient;
    private final KsefReceivedInvoiceRepository receivedRepo;
    private final CertificateCryptoUtils cryptoUtils;
    private final KsefApiProperties apiProperties;

    // "Subject2" tells KSeF we are asking as the BUYER → invoices issued TO us.
    private static final String SUBJECT_BUYER = "Subject2";
    // We page through results in chunks; KSeF caps page size, 100 is a safe value.
    private static final int PAGE_SIZE = 100;
    // Safety stop so a huge window can never loop forever.
    private static final int MAX_PAGES = 100;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    // Small summary returned to the caller after a sync run.
    public record SyncResult(int fetched, int created, int skipped) {}

    /**
     * Pulls purchase-invoice metadata from KSeF for the given date window and stores anything new.
     *
     * @param tenantId the tenant
     * @param nip      the tenant's own 10-digit NIP (the buyer context for authentication)
     * @param from     window start (defaults to 30 days ago if null)
     * @param to       window end (defaults to now if null) — KSeF allows at most a 3-month span
     */
    public SyncResult syncReceivedInvoices(String tenantId, String nip, LocalDateTime from, LocalDateTime to) {
        LocalDateTime windowTo = (to != null) ? to : LocalDateTime.now();
        LocalDateTime windowFrom = (from != null) ? from : windowTo.minusDays(30);

        log.info("[syncReceivedInvoices]:1 Syncing received invoices for tenant [{}] window [{} .. {}]",
                tenantId, windowFrom, windowTo);

        String accessToken = authService.openSession(tenantId, nip);
        QueryInvoicesMetadataRequest request = new QueryInvoicesMetadataRequest(
                SUBJECT_BUYER,
                new QueryInvoicesMetadataRequest.DateRange("Issue", windowFrom.format(ISO), windowTo.format(ISO)));

        int fetched = 0, created = 0, skipped = 0;
        for (int page = 0; page < MAX_PAGES; page++) {
            QueryInvoicesMetadataResponse response =
                    ksefApiClient.queryInvoiceMetadata(accessToken, request, page, PAGE_SIZE);
            List<InvoiceMetadata> invoices = response.invoices();
            if (invoices == null || invoices.isEmpty()) {
                break;
            }
            for (InvoiceMetadata meta : invoices) {
                fetched++;
                // Dedupe: if we already have this KSeF number for this tenant, skip it.
                if (receivedRepo.existsByTenantIdAndKsefNumber(tenantId, meta.ksefNumber())) {
                    skipped++;
                    continue;
                }
                receivedRepo.save(toEntity(tenantId, meta));
                created++;
            }
            if (!response.hasMore()) {
                break;
            }
        }

        KSeFAuditLogService.writeAuditLog(tenantId, "RECEIVED_INVOICES_SYNCED", null, null,
                "window=" + windowFrom + ".." + windowTo + " fetched=" + fetched + " created=" + created,
                null, null);

        log.info("[syncReceivedInvoices]:2 Sync done for tenant [{}] — fetched={}, created={}, skipped(existing)={}",
                tenantId, fetched, created, skipped);
        return new SyncResult(fetched, created, skipped);
    }

    /** Paginated list of received invoices for the tenant (metadata only). */
    public Page<KsefReceivedInvoice> listReceived(String tenantId, Pageable pageable) {
        return receivedRepo.findByTenantIdAndSoftDeletedFalseOrderByIssueDateDesc(tenantId, pageable);
    }

    /**
     * Returns the full invoice XML for one received invoice. The first time it is requested we
     * download it from KSeF and store it encrypted; after that we serve the stored copy.
     *
     * @param nip the tenant's own NIP (buyer context) — needed only if we must fetch from KSeF
     */
    public String getReceivedInvoiceXml(String tenantId, String ksefNumber, String nip) {
        KsefReceivedInvoice invoice = receivedRepo.findByTenantIdAndKsefNumber(tenantId, ksefNumber)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Received invoice [" + ksefNumber + "] not found for tenant [" + tenantId + "]"));

        // Already downloaded → decrypt and return the stored copy (no KSeF call needed).
        if (invoice.getXmlContentEncrypted() != null) {
            byte[] encrypted = Base64.getDecoder().decode(invoice.getXmlContentEncrypted());
            return new String(cryptoUtils.aesDecrypt(encrypted), StandardCharsets.UTF_8);
        }

        // Not downloaded yet → fetch from KSeF, store encrypted, return.
        log.info("[getReceivedInvoiceXml]:1 Fetching XML for received invoice [{}] (tenant [{}]) from KSeF",
                ksefNumber, tenantId);
        String accessToken = authService.openSession(tenantId, nip);
        String xml = ksefApiClient.getInvoiceByKsefNumber(accessToken, ksefNumber);

        invoice.setXmlHash(sha256Hex(xml));
        byte[] encryptedBytes = cryptoUtils.aesEncrypt(xml.getBytes(StandardCharsets.UTF_8));
        invoice.setXmlContentEncrypted(Base64.getEncoder().encodeToString(encryptedBytes));
        invoice.setUpdatedAt(LocalDateTime.now());
        receivedRepo.save(invoice);

        KSeFAuditLogService.writeAuditLog(tenantId, "RECEIVED_INVOICE_DOWNLOADED", invoice.getId(), null,
                "ksefNumber=" + ksefNumber, null, null);
        return xml;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private KsefReceivedInvoice toEntity(String tenantId, InvoiceMetadata meta) {
        return KsefReceivedInvoice.builder()
                .tenantId(tenantId)
                .ksefNumber(meta.ksefNumber())
                .invoiceNumber(meta.invoiceNumber())
                .issueDate(meta.issueDate())
                .acquisitionDate(meta.acquisitionDate())
                .sellerNip(meta.seller() != null ? meta.seller().bestIdentifier() : null)
                .sellerName(meta.seller() != null ? meta.seller().name() : null)
                .buyerIdentifier(meta.buyer() != null ? meta.buyer().bestIdentifier() : null)
                .buyerName(meta.buyer() != null ? meta.buyer().name() : null)
                .netAmount(meta.netAmount())
                .vatAmount(meta.vatAmount())
                .grossAmount(meta.grossAmount())
                .currency(meta.currency())
                .invoiceType(meta.invoiceType())
                .invoicingMode(meta.invoicingMode())
                .selfInvoicing(Boolean.TRUE.equals(meta.isSelfInvoicing()))
                .hasAttachment(Boolean.TRUE.equals(meta.hasAttachment()))
                .ksefEnvironment(apiProperties.getEnvironment() != null ? apiProperties.getEnvironment().name() : null)
                .fetchedAt(LocalDateTime.now())
                .build();
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
