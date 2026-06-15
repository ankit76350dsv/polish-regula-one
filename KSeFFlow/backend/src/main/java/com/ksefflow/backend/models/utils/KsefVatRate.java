package com.ksefflow.backend.models.utils;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import java.math.BigDecimal ;

// Polish VAT rates as defined in the FA(3) KSeF schema and Polish VAT Act.
//
// Each constant carries its decimal multiplier so services can compute
// vatAmount = netAmount.multiply(rate.getMultiplier()) without a switch statement.
//
// EXEMPT        — supply legally outside VAT scope (e.g. medical, educational)
// REVERSE_CHARGE — buyer accounts for VAT (B2B cross-border, Article 17 supplies)
@Getter
@RequiredArgsConstructor
public enum KsefVatRate {

    VAT_23("23", new BigDecimal("0.23")),
    VAT_8("8",   new BigDecimal("0.08")),
    VAT_5("5",   new BigDecimal("0.05")),
    VAT_0("0",   new BigDecimal("0.00")),
    EXEMPT("exempt",        BigDecimal.ZERO),
    REVERSE_CHARGE("reverse_charge", BigDecimal.ZERO);

    // Display label matching the frontend dropdown values and FA(3) XML attribute values
    private final String code;

    // Decimal multiplier for VAT calculation — BigDecimal for exact arithmetic
    private final BigDecimal multiplier;
}
