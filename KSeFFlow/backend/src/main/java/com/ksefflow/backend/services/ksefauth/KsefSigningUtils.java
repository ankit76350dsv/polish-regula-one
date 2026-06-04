package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.exceptions.KsefAuthException;

import java.nio.charset.StandardCharsets;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.cert.X509Certificate;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.PSSParameterSpec;
import java.util.Base64;

// Pure static utilities for signing and certificate encoding.
// No Spring context needed — all methods are stateless.
public final class KsefSigningUtils {

    private KsefSigningUtils() {}

    // Signs the KSeF challenge string using SHA256withRSA.
    //
    // The challenge from the government is a plain UTF-8 string.
    // Java's Signature.SHA256withRSA hashes and signs in one step —
    // the result is RSA(SHA-256(challengeBytes)).
    // The government verifies this using the public certificate submitted alongside it.
    //
    //! Returns Base64-encoded signature bytes (no line breaks, standard encoding).
    public static String signChallenge(String challenge, PrivateKey privateKey) {
        try {
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initSign(privateKey);
            sig.update(challenge.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(sig.sign());
        } catch (Exception e) {
            throw new KsefAuthException(
                    "Failed to sign KSeF challenge with SHA256withRSA: " + e.getMessage(), e);
        }
    }

    // Signs the KSeF offline CODE II ("CERTYFIKAT") QR URL path and returns the
    // signature as Base64URL (no padding), per the MF QR-code specification.
    //
    // The spec mandates one of:
    //   - RSA  → RSASSA-PSS (SHA-256, MGF1-SHA256, 32-byte salt, ≥2048-bit key)
    //   - EC   → ECDSA on NIST P-256 with SHA-256
    // The algorithm is chosen from the signing key's type.
    public static String signQrPathBase64Url(String urlPath, PrivateKey privateKey) {
        try {
            String keyAlg = privateKey.getAlgorithm();
            Signature sig;
            if ("RSA".equalsIgnoreCase(keyAlg) || "RSASSA-PSS".equalsIgnoreCase(keyAlg)) {
                sig = Signature.getInstance("RSASSA-PSS");
                sig.setParameter(new PSSParameterSpec(
                        "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, 32, 1));
            } else if ("EC".equalsIgnoreCase(keyAlg) || "ECDSA".equalsIgnoreCase(keyAlg)) {
                sig = Signature.getInstance("SHA256withECDSA");
            } else {
                throw new KsefAuthException("Unsupported QR signing key algorithm: " + keyAlg);
            }
            sig.initSign(privateKey);
            sig.update(urlPath.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(sig.sign());
        } catch (KsefAuthException e) {
            throw e;
        } catch (Exception e) {
            throw new KsefAuthException(
                    "Failed to sign KSeF offline QR path: " + e.getMessage(), e);
        }
    }

    // DER-encodes the X509 certificate and Base64-encodes the result.
    //
    // KSeF expects the certificate in Base64(DER) format — no PEM "BEGIN CERTIFICATE" headers.
    // cert.getEncoded() returns the raw ASN.1 DER bytes; Base64 encoding those bytes
    // gives the certificateBase64 field required by the /Authorisation request.
    public static String encodeCertificate(X509Certificate cert) {
        try {
            return Base64.getEncoder().encodeToString(cert.getEncoded());
        } catch (Exception e) {
            throw new KsefAuthException(
                    "Failed to DER-encode X509 certificate: " + e.getMessage(), e);
        }
    }
}
