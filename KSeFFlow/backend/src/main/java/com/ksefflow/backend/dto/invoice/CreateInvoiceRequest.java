package com.ksefflow.backend.dto.invoice;

import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefCurrency;
import com.ksefflow.backend.models.utils.KsefPaymentMethod;
import com.ksefflow.backend.models.utils.KsefVatRate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

// Request DTO for creating a new invoice (POST /api/v1/invoices).
// All FA(3)-required fields are validated here before the invoice is persisted.
// Validation mirrors the FA(3) schema requirements so rejections are shown to
// the user before any KSeF API call is made.
@Data
public class CreateInvoiceRequest {

    // ── Invoice identity ───────────────────────────────────────────────────────

    // FA(3)-compliant format: FV/YYYY/MM/SEQUENCE — validated by backend for uniqueness
    @NotBlank(message = "Invoice number is required")
    @Pattern(regexp = "FV/\\d{4}/\\d{2}/\\d+",
             message = "Invoice number must follow format FV/YYYY/MM/SEQUENCE (e.g. FV/2026/05/0001)")
    private String invoiceNumber;

    @NotNull(message = "Issue date is required")
    private LocalDate issueDate;

    private LocalDate dueDate;

    // ── Seller ─────────────────────────────────────────────────────────────────

    @NotBlank(message = "Seller name is required")
    private String sellerName;

    @NotBlank(message = "Seller NIP is required")
    @Pattern(regexp = "\\d{10}", message = "Seller NIP must be exactly 10 digits")
    private String sellerNip;

    @NotBlank(message = "Seller address is required")
    private String sellerAddress;

    @NotBlank(message = "Seller postal code is required")
    private String sellerPostalCode;

    @NotBlank(message = "Seller city is required")
    private String sellerCity;

    // ── Buyer ──────────────────────────────────────────────────────────────────

    @NotBlank(message = "Buyer name is required")
    private String buyerName;

    @NotBlank(message = "Buyer NIP is required")
    @Pattern(regexp = "\\d{10}", message = "Buyer NIP must be exactly 10 digits")
    private String buyerNip;

    @NotBlank(message = "Buyer address is required")
    private String buyerAddress;

    @NotBlank(message = "Buyer postal code is required")
    private String buyerPostalCode;

    @NotBlank(message = "Buyer city is required")
    private String buyerCity;

    // ── Financials ─────────────────────────────────────────────────────────────

    private KsefCurrency currency = KsefCurrency.PLN;

    @NotNull(message = "Total net amount is required")
    @DecimalMin(value = "0.00", inclusive = true, message = "Total net must be non-negative")
    private BigDecimal totalNet;

    @NotNull(message = "Total VAT amount is required")
    private BigDecimal totalVat;

    @NotNull(message = "Total gross amount is required")
    @DecimalMin(value = "0.01", message = "Total gross must be positive")
    private BigDecimal totalGross;

    @NotNull(message = "Payment method is required")
    private KsefPaymentMethod paymentMethod;

    // Required when paymentMethod == SPLIT_PAYMENT — validated in service layer
    private String bankAccount;

    private String notes;

    // ── Line items ──────────────────────────────────────────────────────────────

    @NotEmpty(message = "At least one line item is required")
    @Valid
    private List<InvoiceItemRequest> items = new ArrayList<>();

    // ── Mapping ────────────────────────────────────────────────────────────────

    // Converts this DTO into a KsefInvoice entity suitable for saving.
    // tenantId and createdByUserId are injected by the controller from the security context.
    public KsefInvoice toEntity(String tenantId, String createdByUserId) {
        KsefInvoice invoice = new KsefInvoice();
        invoice.setTenantId(tenantId);
        invoice.setCreatedByUserId(createdByUserId);

        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setIssueDate(issueDate);
        invoice.setDueDate(dueDate);

        invoice.setSellerName(sellerName);
        invoice.setSellerNip(sellerNip);
        invoice.setSellerAddress(sellerAddress);
        invoice.setSellerPostalCode(sellerPostalCode);
        invoice.setSellerCity(sellerCity);

        invoice.setBuyerName(buyerName);
        invoice.setBuyerNip(buyerNip);
        invoice.setBuyerAddress(buyerAddress);
        invoice.setBuyerPostalCode(buyerPostalCode);
        invoice.setBuyerCity(buyerCity);

        invoice.setCurrency(currency != null ? currency : KsefCurrency.PLN);
        invoice.setTotalNet(totalNet);
        invoice.setTotalVat(totalVat);
        invoice.setTotalGross(totalGross);
        invoice.setPaymentMethod(paymentMethod);
        invoice.setBankAccount(bankAccount);
        invoice.setNotes(notes);

        List<KsefInvoice.InvoiceItem> entityItems = items.stream()
                .map(this::toItemEntity)
                .toList();
        invoice.setItems(entityItems);

        return invoice;
    }

    private KsefInvoice.InvoiceItem toItemEntity(InvoiceItemRequest req) {
        KsefInvoice.InvoiceItem item = new KsefInvoice.InvoiceItem();
        item.setItemId(req.getItemId());
        item.setProductName(req.getProductName());
        item.setUnit(req.getUnit());
        item.setQuantity(req.getQuantity());
        item.setUnitPrice(req.getUnitPrice());
        item.setVatRate(req.getVatRate() != null ? req.getVatRate() : KsefVatRate.VAT_23);
        item.setNetAmount(req.getNetAmount());
        item.setVatAmount(req.getVatAmount());
        item.setGrossAmount(req.getGrossAmount());
        item.setPkwiuCode(req.getPkwiuCode());
        return item;
    }
}
