package com.ksefflow.backend.services;

import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.services.certificate.CertificateService;
import com.ksefflow.backend.services.ksefauth.KsefSigningUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.PrivateKey;

/**
 * Generates the two QR codes required for invoices issued when KSeF is unavailable
 * (Offline24, KSeF Unavailability, or Emergency mode).
 *
 * CODE I (OFFLINE):
 * - Contains information that helps identify and verify the invoice later in KSeF.
 * - Built using the invoice details and the FA(3) XML hash.
 * - Allows the buyer to verify the invoice after it is successfully uploaded to KSeF.
 *
 * CODE II (CERTIFICATE):
 * - Proves which company issued the invoice before it is uploaded to KSeF.
 * - Created by digitally signing key invoice information using the tenant's certificate.
 * - The signature can be verified using the corresponding public certificate.
 *
 * Both QR codes are generated on the server.
 * CODE II uses the certificate's private key, which is sensitive and must never
 * be exposed to the browser or frontend application.
 *
 * NOTE:
 * The current implementation follows the expected KSeF offline flow, but the exact
 * QR code format and certificate requirements must still be verified against the
 * official KSeF 2.0 documentation before production use. Until that verification
 * is completed, this implementation should not be considered fully compliant.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OfflineQrService {

    private final CertificateService certificateService;

    // MF verification endpoint the QR links point at (confirm exact host/path with the spec).
    @Value("${ksef.offline.verification-base-url:https://ksef.mf.gov.pl/web/verify}")
    private String verificationBaseUrl;

    /**
     * CODE I — the "OFFLINE" QR payload (a verification URL).
     * Requires {@code invoice.fa3XmlHash} to be set (the invoice's distinguishing feature).
     */
    public String generateOfflineCode(KsefInvoice invoice) {
        String hash = invoice.getFa3XmlHash() != null ? invoice.getFa3XmlHash() : "pending";
        String url = verificationBaseUrl
                + "?nip=" + enc(invoice.getSellerNip())
                + "&num=" + enc(invoice.getInvoiceNumber())
                + "&hash=" + enc(hash);
        log.debug("[OfflineQr] CODE I (OFFLINE) built for invoice [{}]", invoice.getInvoiceNumber());
        return url;
    }

    /**
     * CODE II — the "CERTYFIKAT" QR payload (a verification URL carrying a certificate seal).
     * Seals a canonical representation of the invoice's identifying fields with the tenant's
     * certificate private key so the buyer can confirm issuer identity before KSeF upload.
     */
    public String generateCertificateCode(KsefInvoice invoice) {
        PrivateKey privateKey = certificateService.getPrivateKey(invoice.getTenantId());

        // Canonical payload — the stable, issuer-attributable identity of this invoice.
        // COMPLIANCE: replace with the MF-prescribed canonical form before production.
        String canonical = String.join("|",
                safe(invoice.getSellerNip()),
                safe(invoice.getInvoiceNumber()),
                invoice.getIssueDate() != null ? invoice.getIssueDate().toString() : "",
                invoice.getTotalGross() != null ? invoice.getTotalGross().toPlainString() : "",
                safe(invoice.getFa3XmlHash()));

        String seal = KsefSigningUtils.signChallenge(canonical, privateKey); // RSA-SHA256 → Base64

        String url = verificationBaseUrl
                + "?nip=" + enc(invoice.getSellerNip())
                + "&num=" + enc(invoice.getInvoiceNumber())
                + "&seal=" + enc(seal);
        log.debug("[OfflineQr] CODE II (CERTYFIKAT) built for invoice [{}]", invoice.getInvoiceNumber());
        return url;
    }

    private static String enc(String s) {
        return URLEncoder.encode(s != null ? s : "", StandardCharsets.UTF_8);
    }

    private static String safe(String s) {
        return s != null ? s : "";
    }
}
