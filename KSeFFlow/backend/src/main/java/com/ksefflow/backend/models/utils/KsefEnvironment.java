package com.ksefflow.backend.models.utils;

// KSeF operating environment. Controls which API base URL and certificate chain is used.
//
// SANDBOX    — https://ksef-test.mf.gov.pl  (test environment — invoices have no legal effect)
// PRODUCTION — https://ksef.mf.gov.pl       (live environment — legally binding invoices)
//
// Each tenant session, API log, and certificate reference must record which environment
// was active so production data is never contaminated by test submissions.
public enum KsefEnvironment {
    SANDBOX,
    PRODUCTION
}
