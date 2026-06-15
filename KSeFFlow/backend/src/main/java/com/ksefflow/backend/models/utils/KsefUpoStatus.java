package com.ksefflow.backend.models.utils;

// Status of the Urzędowe Potwierdzenie Odbioru (UPO) — the official government
// receipt confirmation issued by KSeF after a successful invoice submission.
//
// Legal requirement: UPOs must be retained for 10 years per Polish tax law.
// The UPO XML/PDF file is stored in encrypted S3; this enum tracks its pipeline state.
public enum KsefUpoStatus {

    // No UPO generated yet — invoice not yet submitted or still pending
    NONE,

    // UPO request sent to KSeF API; awaiting response
    GENERATED,

    // UPO XML received from KSeF and saved to encrypted storage
    RECEIVED,

    // UPO signature cryptographically verified against KSeF public key
    VERIFIED
}
