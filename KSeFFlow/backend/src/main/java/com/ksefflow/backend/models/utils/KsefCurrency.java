package com.ksefflow.backend.models.utils;

// Currencies accepted by the KSeFFlow module.
// PLN is the legally required reporting currency for Polish VAT purposes;
// EUR and USD are supported for foreign-currency invoices where the VAT
// equivalent must still be reported in PLN on the VAT return.
public enum KsefCurrency {
    PLN,
    EUR,
    USD
}
