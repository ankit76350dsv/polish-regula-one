package com.ksefflow.backend.models.utils;

// Tracks whether the invoice has been settled by the buyer.
// Independent of KsefInvoiceStatus — a SENT invoice can be either PAID or UNPAID.
public enum KsefPaymentStatus {
    PAID,
    UNPAID
}
