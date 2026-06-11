package com.ksefflow.backend.models.utils;

// SIMPLE EXPLANATION:
// This tells us what state the government KSeF system is in RIGHT NOW, as KSeFFlow sees it.
// It decides which legal rules apply when we cannot send an invoice the normal (online) way.
//
//   ONLINE                 → KSeF is working. Invoices go straight through.
//   OFFLINE_UNAVAILABILITY → KSeF is not reachable / not responding. We can still ISSUE
//                            invoices offline, but each one must reach KSeF by the NEXT
//                            business day once it is back.
//   EMERGENCY              → The Ministry of Finance has officially DECLARED a KSeF failure
//                            ("tryb awaryjny", announced on the MF BIP page). In this state
//                            an offline invoice has a longer window: up to 7 business days
//                            from the end of the declared failure.
//
// The difference matters legally because it changes the DEADLINE by which the invoice must
// be in KSeF (Polish VAT Act: art. 106nh unavailability vs art. 106nf emergency).
public enum KsefServiceMode {

    // KSeF is up and accepting invoices normally.
    ONLINE,

    // KSeF cannot be reached — system-detected unavailability (next-business-day window).
    OFFLINE_UNAVAILABILITY,

    // Ministry-declared outage / "tryb awaryjny" — 7-business-day window. Set by an admin
    // based on the official MF announcement; never cleared automatically by the health check.
    EMERGENCY
}
