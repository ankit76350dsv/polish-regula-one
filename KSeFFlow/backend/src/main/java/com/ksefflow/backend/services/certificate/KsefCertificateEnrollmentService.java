package com.ksefflow.backend.services.certificate;

import com.ksefflow.backend.dto.ksefapi.*;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.utils.KsefCertificatePurpose;
import com.ksefflow.backend.services.ksefauth.KSeFAuthService;
import com.ksefflow.backend.services.ksefauth.KsefApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.io.ByteArrayInputStream;
import java.util.Base64;
import java.util.List;

/**
 * KsefCertificateEnrollmentService — requests and downloads a KSeF-issued certificate (gap C3).
 *
 * SIMPLE EXPLANATION (the whole flow in one place):
 * Before mandatory KSeF, KSeFFlow only handled certificates the user UPLOADED. But KSeF 2.0
 * issues its OWN certificates, and from 2027 they are the only way to log in; the "Offline"
 * type is also what seals offline-invoice QR codes. This service gets one for a tenant:
 *
 *   1. Ask KSeF what identity to put in the request   (GET /certificates/enrollments/data)
 *   2. Make a fresh key pair + a signed CSR with that identity   (KsefCsrGenerator)
 *   3. Send the CSR to KSeF                            (POST /certificates/enrollments)
 *   4. Wait until KSeF says the certificate is ready   (GET /certificates/enrollments/{ref})
 *   5. Download the issued certificate                 (POST /certificates/retrieve)
 *   6. Put our private key + the issued certificate into a PKCS12 and store it ENCRYPTED,
 *      reusing the existing certificate storage (CertificateService.storeEnrolledCertificate)
 *
 * We keep our private key in memory for the whole call and only ever store it encrypted, so the
 * private key is never written anywhere in the clear. The flow is run synchronously (we wait for
 * KSeF to finish in steps 4–5) precisely so we never have to persist a "dangling" private key
 * while waiting.
 *
 * Official reference: KSeF 2.0 "Certyfikaty KSeF" + API certificate endpoints.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KsefCertificateEnrollmentService {

    private final KSeFAuthService authService;
    private final KsefApiClient ksefApiClient;
    private final KsefCsrGenerator csrGenerator;
    private final CertificateService certificateService;

    // KSeF enrollment status codes (from the API docs).
    private static final int STATUS_PROCESSING = 100; // accepted, still being processed
    private static final int STATUS_DONE = 200;       // certificate generated
    // How long we wait for KSeF to issue the certificate before giving up (≈ 30 s total).
    private static final int POLL_MAX_ATTEMPTS = 15;
    private static final long POLL_INTERVAL_MS = 2000;

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Runs the full enroll → poll → retrieve → store flow and returns the stored certificate.
     *
     * @param tenantId        the tenant
     * @param nip             the tenant's own NIP (authentication context for KSeF)
     * @param certificateName a friendly name for the certificate
     * @param purpose         AUTHENTICATION (log in) or OFFLINE (seal offline invoices)
     * @param userId          who requested it (for audit)
     */
    public KsefCertificate enrollAndStore(String tenantId, String nip, String certificateName,
                                          KsefCertificatePurpose purpose, String userId) {
        log.info("[enrollAndStore]:1 Starting KSeF certificate enrollment — tenant [{}], purpose [{}], name [{}]",
                tenantId, purpose, certificateName);

        String accessToken = authService.openSession(tenantId, nip);

        // 1. What identity must the certificate carry?
        CertificateEnrollmentDataResponse data = ksefApiClient.getCertificateEnrollmentData(accessToken);

        // 2. New key pair + CSR built from that identity.
        KsefCsrGenerator.CsrResult csr = csrGenerator.generate(data);

        // 3. Submit the CSR. The API certificate type string is "Authentication" / "Offline".
        String apiType = (purpose == KsefCertificatePurpose.OFFLINE) ? "Offline" : "Authentication";
        EnrollCertificateResponse enroll = ksefApiClient.enrollCertificate(accessToken,
                new EnrollCertificateRequest(certificateName, apiType, csr.csrDerBase64(), null));
        String referenceNumber = enroll.referenceNumber();
        log.info("[enrollAndStore]:2 Enrollment submitted — referenceNumber [{}]", referenceNumber);

        // 4. Wait until KSeF has generated the certificate; get its serial number.
        String serialNumber = pollUntilIssued(accessToken, referenceNumber);

        // 5. Download the issued (public) certificate.
        RetrieveCertificatesResponse retrieved = ksefApiClient.retrieveCertificates(accessToken,
                new RetrieveCertificatesRequest(List.of(serialNumber)));
        if (retrieved.certificates() == null || retrieved.certificates().isEmpty()) {
            throw new KsefCertificateException("KSeF returned no certificate for serial " + serialNumber);
        }
        RetrieveCertificatesResponse.RetrievedCertificate item = retrieved.certificates().get(0);
        X509Certificate issuedCert = decodeDerCertificate(item.certificate());

        // 6. Package our private key + the issued certificate into a PKCS12 and store it encrypted.
        String password = randomPassword();
        byte[] pkcs12 = buildPkcs12(csr.keyPair().getPrivate(), issuedCert, password);
        KsefCertificate stored = certificateService.storeEnrolledCertificate(
                pkcs12, tenantId, certificateName + ".p12", password, userId, purpose, serialNumber);

        log.info("[enrollAndStore]:3 KSeF certificate stored — tenant [{}], serial [{}], purpose [{}]",
                tenantId, serialNumber, purpose);
        return stored;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    // Polls the enrollment status until the certificate is generated (code 200) and returns its
    // serial number. Throws on a rejection code or if it does not finish within the poll budget.
    private String pollUntilIssued(String accessToken, String referenceNumber) {
        for (int attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
            CertificateEnrollmentStatusResponse status =
                    ksefApiClient.getCertificateEnrollmentStatus(accessToken, referenceNumber);
            Integer code = status.status() != null ? status.status().code() : null;

            if (code != null && code == STATUS_DONE) {
                if (status.certificateSerialNumber() == null || status.certificateSerialNumber().isBlank()) {
                    throw new KsefCertificateException("KSeF reported the certificate ready but gave no serial number");
                }
                log.info("[pollUntilIssued]:1 Certificate issued for ref [{}] — serial [{}]",
                        referenceNumber, status.certificateSerialNumber());
                return status.certificateSerialNumber();
            }
            if (code != null && code != STATUS_PROCESSING) {
                // Any non-100, non-200 code is a rejection / error (400/500/550).
                String desc = status.status().description() != null ? status.status().description() : "";
                throw new KsefCertificateException("KSeF rejected the certificate request (code " + code + "): " + desc);
            }
            if (attempt < POLL_MAX_ATTEMPTS) {
                sleepQuietly(POLL_INTERVAL_MS);
            }
        }
        throw new KsefCertificateException("KSeF did not issue the certificate in time for ref " + referenceNumber
                + " — try downloading it later once it is ready");
    }

    // Turns the Base64-encoded DER certificate from KSeF into an X509Certificate object.
    private X509Certificate decodeDerCertificate(String base64Der) {
        try {
            byte[] der = Base64.getDecoder().decode(base64Der);
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            return (X509Certificate) factory.generateCertificate(new ByteArrayInputStream(der));
        } catch (Exception e) {
            throw new KsefCertificateException("Could not read the certificate KSeF returned: " + e.getMessage(), e);
        }
    }

    // Builds a PKCS12 (.p12) keystore holding our private key + the issued certificate, protected
    // by the given password. This is the same format CertificateService already knows how to store.
    private byte[] buildPkcs12(java.security.PrivateKey privateKey, X509Certificate cert, String password) {
        try {
            KeyStore keyStore = KeyStore.getInstance("PKCS12");
            keyStore.load(null, null); // start an empty keystore
            keyStore.setKeyEntry("ksef", privateKey, password.toCharArray(), new Certificate[]{cert});
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            keyStore.store(out, password.toCharArray());
            return out.toByteArray();
        } catch (Exception e) {
            throw new KsefCertificateException("Could not package the issued certificate: " + e.getMessage(), e);
        }
    }

    // Generates a strong random password used only to protect the in-app PKCS12 file. It is then
    // encrypted by CertificateService — it is never shown to anyone or stored in the clear.
    private String randomPassword() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
