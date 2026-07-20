package com.regulaone.backend.services;

import com.regulaone.backend.dto.Admin.InvoiceResponse;
import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.Invoice;
import com.regulaone.backend.models.InvoiceStatus;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

// Handles creation and retrieval of billing invoices.
// Intentionally a separate service from UserService so billing logic stays isolated
// and can evolve independently (e.g. add Stripe webhooks, PDF generation, etc.)
@Service
@RequiredArgsConstructor
public class BillingService {

    private final InvoiceRepository invoiceRepository;

    // Creates and persists a new invoice for the given tenant + package.
    //
    // isFree = true  → org setup flow, default package, amount=0, status=FREE
    // isFree = false → plan change (upgrade/downgrade), amount=pkg.price, status=PAID
    //
    // Invoice number format: INV-YYYY-NNNN
    // The sequence number is derived from the global invoice count so it is
    // monotonically increasing across all tenants (no per-tenant counter needed).
    public Invoice generateInvoice(Tenant tenant, AppPackage pkg, boolean isFree) {

        LocalDateTime now = LocalDateTime.now();

        // periodEnd is based on the package duration (in days) so the invoice
        // period always reflects the actual service window being billed.
        LocalDateTime periodEnd = (pkg.getDuration() != null)
                ? now.plusDays(pkg.getDuration())
                : now.plusMonths(1);

        return generateInvoice(tenant, pkg, isFree, now, periodEnd);
    }

    // Overload that lets the caller specify the exact billing period. Used by
    // package renewal, where the new period may start when the OLD one ends
    // (stacked renewal) rather than "now", so the invoice reflects the real
    // service window being paid for.
    public Invoice generateInvoice(Tenant tenant, AppPackage pkg, boolean isFree,
                                   LocalDateTime periodStart, LocalDateTime periodEnd) {

        long nextSeq = invoiceRepository.count() + 1;
        int year = LocalDateTime.now().getYear();
        String invoiceNumber = String.format("INV-%d-%04d", year, nextSeq);

        BigDecimal amount = isFree ? BigDecimal.ZERO : (pkg.getPrice() != null ? pkg.getPrice() : BigDecimal.ZERO);
        String currency   = pkg.getCurrency() != null ? pkg.getCurrency() : "EUR";

        Invoice invoice = Invoice.builder()
                .tenant(tenant)
                .invoiceNumber(invoiceNumber)
                // Snapshot the name at invoice time — the catalogue entry may change later
                .packageName(pkg.getName())
                .amount(amount)
                .currency(currency)
                .status(isFree ? InvoiceStatus.FREE : InvoiceStatus.PAID)
                .periodStart(periodStart)
                .periodEnd(periodEnd)
                .createdAt(LocalDateTime.now())
                .build();

        return invoiceRepository.save(invoice);
    }

    // Returns all invoices for a tenant sorted newest-first.
    // Used by GET /api/admin/billing to populate the Billing History table.
    public List<InvoiceResponse> getTenantInvoices(String tenantId) {
        return invoiceRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId)
                .stream()
                .map(InvoiceResponse::from)
                .collect(Collectors.toList());
    }
}
