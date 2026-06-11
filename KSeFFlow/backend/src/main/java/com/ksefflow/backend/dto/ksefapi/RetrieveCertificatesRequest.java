package com.ksefflow.backend.dto.ksefapi;

import java.util.List;

// Request body for POST /certificates/retrieve — asks KSeF to return the issued certificate(s)
// for the given serial number(s).
public record RetrieveCertificatesRequest(List<String> certificateSerialNumbers) {}
