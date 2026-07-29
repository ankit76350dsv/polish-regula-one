package com.ksefflow.backend.services;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.DashboardSummaryResponse;
import com.ksefflow.backend.dto.DashboardSummaryResponse.CertificateSummary;
import com.ksefflow.backend.dto.DashboardSummaryResponse.CurrencyTotals;
import com.ksefflow.backend.dto.DashboardSummaryResponse.InvoiceCounts;
import com.ksefflow.backend.dto.DashboardSummaryResponse.KsefStatusSummary;
import com.ksefflow.backend.dto.DashboardSummaryResponse.RecentInvoice;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefCertificatePurpose;
import com.ksefflow.backend.models.utils.KsefCertificateVerificationStatus;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.repository.KsefCertificateRepository;
import com.ksefflow.backend.repository.KsefInvoiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DashboardService — builds the one-shot dashboard summary for a tenant.
 *
 * SIMPLE EXPLANATION (why this exists):
 * The dashboard used to compute everything in the browser from a partial invoice list (and a fake
 * exchange rate), so the numbers were wrong. This service computes the REAL figures on the server
 * from the tenant's own data, in a single call, so the dashboard is accurate and fast.
 *
 * Design notes:
 *  - Counts use the indexed count queries (cheap).
 *  - Money totals are summed in Java over a tiny projected query (only the 4 money/currency fields),
 *    grouped by currency. We do NOT invent an FX rate — each currency is reported separately, which
 *    is the compliant way (PLN is the legal reporting currency; foreign currencies stay separate).
 *  - Everything is tenant-scoped (multi-tenancy).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardService {

    private final KsefInvoiceRepository invoiceRepository;
    private final KsefCertificateRepository certificateRepository;
    private final KsefAvailabilityService availabilityService;
    private final KsefApiProperties apiProperties;
    private final MongoTemplate mongoTemplate;

    // Certificates within this many days of expiry are flagged "expiring soon".
    private static final int EXPIRY_WARNING_DAYS = 30;
    // How many recent invoices to show in the activity widget.
    private static final int RECENT_LIMIT = 5;

    public DashboardSummaryResponse getSummary(String tenantId) {
        log.info("[getSummary]:1 Building dashboard summary for tenant [{}]", tenantId);

        InvoiceCounts counts = buildCounts(tenantId);
        int needsAttention = (int) (counts.offline() + counts.retrying() + counts.failed());

        // Success rate = accepted / submitted. "Submitted" excludes drafts (never sent).
        long submitted = counts.total() - counts.draft();
        int successRate = submitted > 0 ? (int) Math.round(counts.sent() * 100.0 / submitted) : 100;

        List<CurrencyTotals> totals = buildTotals(tenantId);
        CertificateSummary certificates = buildCertificateSummary(tenantId);
        KsefStatusSummary ksef = buildKsefStatus();
        List<RecentInvoice> recent = buildRecent(tenantId);

        return new DashboardSummaryResponse(counts, needsAttention, successRate, totals, certificates, ksef, recent);
    }

    // ── Counts (indexed, cheap) ──────────────────────────────────────────────────
    private InvoiceCounts buildCounts(String tenantId) {
        return new InvoiceCounts(
                invoiceRepository.countByTenantId(tenantId),
                invoiceRepository.countByTenantIdAndStatus(tenantId, KsefInvoiceStatus.DRAFT),
                invoiceRepository.countByTenantIdAndStatus(tenantId, KsefInvoiceStatus.PENDING),
                invoiceRepository.countByTenantIdAndStatus(tenantId, KsefInvoiceStatus.SENT),
                invoiceRepository.countByTenantIdAndStatus(tenantId, KsefInvoiceStatus.OFFLINE_MODE),
                invoiceRepository.countByTenantIdAndStatus(tenantId, KsefInvoiceStatus.RETRYING),
                invoiceRepository.countByTenantIdAndStatus(tenantId, KsefInvoiceStatus.FAILED));
    }

    // ── Money totals grouped by currency (drafts + soft-deleted excluded) ──────────
    // Summed in Java over a projected query so it is correct regardless of how BigDecimal is stored,
    // and reads only the 4 fields we need.
    private List<CurrencyTotals> buildTotals(String tenantId) {
        Query q = new Query(Criteria.where("tenantId").is(tenantId)
                .and("softDeleted").ne(true)
                .and("status").ne(KsefInvoiceStatus.DRAFT.name()));
        q.fields().include("currency").include("totalNet").include("totalVat").include("totalGross");
        List<KsefInvoice> rows = mongoTemplate.find(q, KsefInvoice.class);

        // Accumulate per currency, preserving first-seen order.
        Map<String, BigDecimal[]> sums = new LinkedHashMap<>();   // currency -> [net, vat, gross]
        Map<String, Long> countByCcy = new LinkedHashMap<>();
        for (KsefInvoice inv : rows) {
            String ccy = inv.getCurrency() != null ? inv.getCurrency().name() : "PLN";
            BigDecimal[] acc = sums.computeIfAbsent(ccy, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            acc[0] = acc[0].add(nz(inv.getTotalNet()));
            acc[1] = acc[1].add(nz(inv.getTotalVat()));
            acc[2] = acc[2].add(nz(inv.getTotalGross()));
            countByCcy.merge(ccy, 1L, Long::sum);
        }

        List<CurrencyTotals> totals = new ArrayList<>();
        sums.forEach((ccy, acc) ->
                totals.add(new CurrencyTotals(ccy, acc[0], acc[1], acc[2], countByCcy.getOrDefault(ccy, 0L))));
        return totals;
    }

    // ── Certificate health ─────────────────────────────────────────────────────────
    private CertificateSummary buildCertificateSummary(String tenantId) {
        List<KsefCertificate> certs = certificateRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
        LocalDate today = LocalDate.now();

        int active = 0, expiringSoon = 0;
        LocalDate nearestExpiry = null;
        boolean hasAuth = false, hasOffline = false;

        for (KsefCertificate c : certs) {
            boolean valid = c.isActive()
                    && c.getVerificationStatus() == KsefCertificateVerificationStatus.VERIFIED
                    && (c.getValidTo() == null || !c.getValidTo().isBefore(today));
            if (!valid) continue;

            active++;
            if (c.getPurpose() == KsefCertificatePurpose.AUTHENTICATION) hasAuth = true;
            if (c.getPurpose() == KsefCertificatePurpose.OFFLINE) hasOffline = true;

            if (c.getValidTo() != null) {
                if (nearestExpiry == null || c.getValidTo().isBefore(nearestExpiry)) {
                    nearestExpiry = c.getValidTo();
                }
                if (!c.getValidTo().isAfter(today.plusDays(EXPIRY_WARNING_DAYS))) {
                    expiringSoon++;
                }
            }
        }
        return new CertificateSummary(active, expiringSoon, nearestExpiry, hasAuth, hasOffline);
    }

    // ── KSeF availability + environment ─────────────────────────────────────────────
    private KsefStatusSummary buildKsefStatus() {
        KsefAvailabilityService.Status st = availabilityService.getStatus();
        String env = apiProperties.getEnvironment() != null ? apiProperties.getEnvironment().name() : "SANDBOX";
        return new KsefStatusSummary(st.mode().name(), env, st.since(), st.reason());
    }

    // ── Recent activity ──────────────────────────────────────────────────────────
    private List<RecentInvoice> buildRecent(String tenantId) {
        List<KsefInvoice> page = invoiceRepository
                .findByTenantIdOrderByCreatedAtDesc(tenantId, PageRequest.of(0, RECENT_LIMIT * 2))
                .getContent();
        List<RecentInvoice> recent = new ArrayList<>();
        for (KsefInvoice inv : page) {
            if (inv.isSoftDeleted()) continue;
            recent.add(new RecentInvoice(
                    inv.getId(), inv.getInvoiceNumber(), inv.getBuyerName(),
                    inv.getStatus().name(), inv.getStatus().getLabel(),
                    inv.getTotalGross(), inv.getCurrency() != null ? inv.getCurrency().name() : "PLN",
                    inv.getCreatedAt()));
            if (recent.size() >= RECENT_LIMIT) break;
        }
        return recent;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
