package com.ksefflow.backend.models.utils;

// Payment methods surfaced on a KSeF invoice.
// SPLIT_PAYMENT is mandatory for B2B VAT transactions above PLN 15,000
// under the Polish split-payment mechanism (MPP — mechanizm podzielonej płatności).
public enum KsefPaymentMethod {

    TRANSFER,

    CARD,

    // Mechanizm Podzielonej Płatności — legally mandated for high-value B2B VAT invoices
    SPLIT_PAYMENT,

    CASH
}
