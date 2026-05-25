package com.ksefflow.backend.dto.ksefapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Step 2 of KSeF auth: request body sent to POST /online/Session/Authorisation.
// Contains the signed challenge and the public certificate so the government can verify
// that the signature was produced by the private key matching the presented certificate.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KsefAuthRequest {

    private KsefContextIdentifier contextIdentifier;

    private KsefDocumentType documentType;

    // The NIP again — must match contextIdentifier.identifier
    private String authenticationIdentifier;

    // The signed challenge — proves possession of the private key
    private KsefSignatureDto signature;

    // Base64-encoded DER bytes of the X509 public certificate
    // (cert.getEncoded() gives DER, then Base64 encode — no PEM headers)
    private String certificateBase64;
}
