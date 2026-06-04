package com.ksefflow.backend.services;

import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.services.certificate.CertificateService;
import com.ksefflow.backend.services.ksefauth.KsefSigningUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.PrivateKey;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

/**
 * Generates the two QR codes required on an invoice issued while KSeF is unavailable
 * (offline24 / KSeF-unavailability / emergency), per the Ministry of Finance QR spec:
 *   https://github.com/CIRFMF/ksef-docs/blob/main/kody-qr.md
 *
 * CODE I — "OFFLINE" (invoice verification):
 *   {base}/invoice/{NIP}/{issueDate DD-MM-YYYY}/{SHA-256 file hash, Base64URL}
 *
 * CODE II — "CERTYFIKAT" (issuer verification, offline only):
 *   {base}/certificate/{ContextType}/{ContextValue}/{SellerNIP}/{SerialNumber}/{FileHash}/{Signature}
 *   The Signature is over the URL path WITHOUT the scheme and WITHOUT the trailing
 *   /{Signature} segment, using the issuer's offline-type KSeF certificate private key
 *   (RSASSA-PSS for RSA, ECDSA P-256 for EC).
 *
 * Both QR codes are produced SERVER-SIDE: CODE II needs the certificate private key,
 * which must never reach the browser. The frontend only renders the resulting URLs.
 *
 * COMPLIANCE: URL shape and hashing now follow the documented MF format. Two items still
 * require confirmation against the official spec/cert before production:
 *   1. CODE II must be sealed with the issuer's active OFFLINE-type KSeF certificate
 *      (a.k.a. "Type 2"); here we use the tenant's stored certificate via CertificateService.
 *   2. {FileHash} must be the SHA-256 of the exact bytes KSeF will receive; we reuse the
 *      invoice's stored fa3XmlHash (re-encoded hex → Base64URL).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OfflineQrService {

    private static final DateTimeFormatter QR_DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private final CertificateService certificateService;

    // QR verification host (no path). Test: https://qr-test.ksef.mf.gov.pl
    // Production: https://qr.ksef.mf.gov.pl
    @Value("${ksef.offline.verification-base-url:https://qr-test.ksef.mf.gov.pl}")
    private String baseUrl;

    /**
     * CODE I — "OFFLINE": {base}/invoice/{NIP}/{DD-MM-YYYY}/{Base64URL SHA-256}
     */
    public String generateInvoiceCode(KsefInvoice invoice) {
        String hash = hexToBase64Url(invoice.getFa3XmlHash());
        String issueDate = invoice.getIssueDate() != null ? invoice.getIssueDate().format(QR_DATE) : "";

        String url = host() + "/invoice/"
                + invoice.getSellerNip() + "/"
                + issueDate + "/"
                + hash;
        log.debug("[OfflineQr] CODE I (OFFLINE) built for invoice [{}]", invoice.getInvoiceNumber());
        return url;
    }

    /**
     * CODE II — "CERTYFIKAT":
     *   {base}/certificate/Nip/{ctxNip}/{sellerNip}/{serial}/{hash}/{signature}
     * where {signature} signs the path (host + everything up to and including {hash}),
     * without the scheme and without the trailing /{signature}.
     */
    public String generateCertificateCode(KsefInvoice invoice) {
        // MUST use the tenant's OFFLINE-purpose KSeF certificate (Non-Repudiation).
        // These calls throw KsefCertificateException if no OFFLINE cert is provisioned —
        // we never fall back to the authentication certificate (would be non-compliant).
        KsefCertificate offlineCert = certificateService.getActiveOfflineCert(invoice.getTenantId());
        PrivateKey privateKey = certificateService.getOfflineSealPrivateKey(invoice.getTenantId());

        String nip = invoice.getSellerNip();
        String serial = offlineCert.getCertificateSerialNumber();
        if (serial == null || serial.isBlank()) {
            throw new KsefCertificateException(
                    "OFFLINE certificate for tenant " + invoice.getTenantId()
                            + " has no certificateSerialNumber — cannot build a compliant QR Code II.");
        }
        String hash = hexToBase64Url(invoice.getFa3XmlHash());

        // Self-issue: the context (whose KSeF the invoice is issued in) is the seller's NIP.
        String contextType = "Nip";
        String contextValue = nip;

        // The exact string that gets signed: host + path, NO scheme, NO trailing /{signature}.
        String hostNoScheme = host().replaceFirst("^https?://", "");
        String signedPath = hostNoScheme + "/certificate/"
                + contextType + "/" + contextValue + "/"
                + nip + "/" + serial + "/" + hash;

        String signature = KsefSigningUtils.signQrPathBase64Url(signedPath, privateKey);

        String url = host() + "/certificate/"
                + contextType + "/" + contextValue + "/"
                + nip + "/" + serial + "/" + hash + "/"
                + signature;
        log.debug("[OfflineQr] CODE II (CERTYFIKAT) built for invoice [{}]", invoice.getInvoiceNumber());
        return url;
    }

    // Strip any trailing slash from the configured base URL.
    private String host() {
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    // Convert the stored hex SHA-256 into Base64URL (no padding) as the spec requires.
    private static String hexToBase64Url(String hex) {
        if (hex == null || hex.isBlank()) return "";
        int len = hex.length();
        if (len % 2 != 0) return ""; // malformed — let validation elsewhere catch it
        byte[] bytes = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            bytes[i / 2] = (byte) Integer.parseInt(hex.substring(i, i + 2), 16);
        }
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
