package com.ksefflow.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Everything the KSeFFlow dashboard needs, in ONE response — so the frontend makes a single call
 * instead of many. All figures are REAL (computed from the tenant's own data), never mocked.
 *
 * @param invoices       counts of the tenant's invoices per lifecycle status
 * @param needsAttention how many invoices currently require a human (offline + retrying + failed)
 * @param successRate    percentage of submitted invoices accepted by KSeF (0–100)
 * @param totals         monetary totals grouped by currency (drafts excluded — they are not issued)
 * @param certificates   certificate health (active, expiring, and which KSeF purposes are covered)
 * @param ksef           current KSeF availability mode + the environment we target
 * @param recent         the few most recent invoices, for an "activity" widget
 */
public record DashboardSummaryResponse(
        InvoiceCounts invoices,
        int needsAttention,
        int successRate,
        List<CurrencyTotals> totals,
        CertificateSummary certificates,
        KsefStatusSummary ksef,
        List<RecentInvoice> recent) {

    // Counts per status. (There is no CORRECTED status — a correction is a normal invoice with a flag.)
    public record InvoiceCounts(
            long total, long draft, long pending, long sent,
            long offline, long retrying, long failed) {}

    // Money totals for one currency. Drafts are excluded because they are not legally issued yet.
    public record CurrencyTotals(String currency, BigDecimal net, BigDecimal vat, BigDecimal gross, long count) {}

    // Certificate health for the tenant.
    public record CertificateSummary(
            int active,             // active + verified + not expired
            int expiringSoon,       // of those, how many expire within 30 days
            LocalDate nearestExpiry,// soonest expiry among active certs (null if none)
            boolean hasAuthentication, // an active AUTHENTICATION cert exists (needed to talk to KSeF)
            boolean hasOffline) {}     // an active OFFLINE cert exists (needed to issue offline)

    // Current KSeF connection state (mirrors the Integration page).
    public record KsefStatusSummary(String mode, String environment, LocalDateTime since, String reason) {}

    // A compact invoice row for the recent-activity list.
    public record RecentInvoice(
            String id, String invoiceNumber, String buyerName,
            String status, String statusLabel,
            BigDecimal totalGross, String currency, LocalDateTime createdAt) {}
}
