package com.ksefflow.backend.dto.invoice;

import com.ksefflow.backend.models.utils.KsefVatRate;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

// One line item in a CreateInvoiceRequest.
// All amounts are provided by the client (pre-calculated) and stored exactly —
// the backend trusts the client amounts but re-validates totals against FA(3) rules.
@Data
public class InvoiceItemRequest {

    // Client-generated UUID (used as React key and for partial updates)
    private String itemId;

    @NotBlank(message = "Product name is required")
    private String productName;

    // e.g. "szt.", "godz.", "kg" — defaults to "szt." if null
    private String unit;

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.001", message = "Quantity must be positive")
    private BigDecimal quantity;

    @NotNull(message = "Unit price is required")
    @DecimalMin(value = "0.00", inclusive = true, message = "Unit price must be non-negative")
    private BigDecimal unitPrice;

    @NotNull(message = "VAT rate is required")
    private KsefVatRate vatRate;

    // Pre-calculated by the client — unitPrice × quantity
    @NotNull(message = "Net amount is required")
    private BigDecimal netAmount;

    // Pre-calculated by the client — netAmount × vatRate.multiplier
    @NotNull(message = "VAT amount is required")
    private BigDecimal vatAmount;

    // Pre-calculated by the client — netAmount + vatAmount
    @NotNull(message = "Gross amount is required")
    private BigDecimal grossAmount;

    // PKWiU classification code — optional, required only for certain VAT rates
    private String pkwiuCode;
}
