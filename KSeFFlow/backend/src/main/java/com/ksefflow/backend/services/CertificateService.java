package com.ksefflow.backend.services;

import com.ksefflow.backend.config.CertificateStorageProperties;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.utils.KsefCertificateType;
import com.ksefflow.backend.models.utils.KsefCertificateVerificationStatus;
import com.ksefflow.backend.repository.KsefCertificateRepository;
import com.ksefflow.backend.services.certificateutils.CertificateCryptoUtils;
import com.ksefflow.backend.services.certificateutils.CertificateStorageUtils;
import com.ksefflow.backend.services.certificateutils.KeyStoreUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Manages the full certificate lifecycle for KSeF government API
 * authentication.
 *
 * Security contract (CLAUDE.md):
 * - .pfx files are AES-256-GCM encrypted before being written to disk (dev) or
 * S3 (prod)
 * - Certificate passwords are AES-256-GCM encrypted — never stored plaintext
 * - Private key material NEVER touches MongoDB — only filesystem/S3 paths are
 * stored
 * - Decryption is always transient (in-memory only) — raw keys are never cached
 * in fields
 * - The master encryption key comes from environment config, never from source
 * code
 *
 * Helper responsibilities:
 * - KeyStoreUtils — PKCS12 loading, X509 and PrivateKey extraction (static)
 * - CertificateCryptoUtils — AES-256-GCM encrypt/decrypt + password vault logic
 * - CertificateStorageUtils — encrypted file read/write on filesystem (dev) or
 * S3 (prod)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CertificateService {

    private final CertificateStorageProperties props;
    private final KsefCertificateRepository certificateRepository;
    private final CertificateCryptoUtils crypto;
    private final CertificateStorageUtils storage;

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Uploads and securely stores a .pfx certificate for a tenant.
     *
     * What this method does:
     * 1. Checks if the uploaded file size is within the configured limit
     * 2. Verifies the .pfx file and password are correct (fails fast before any DB
     * writes)
     * 3. Reads certificate details — owner (CN), issuer, and expiry date — from the
     * file
     * 4. Deactivates the current active certificate (only one active cert per
     * tenant)
     * 5. Encrypts the .pfx and stores it on disk/S3
     * 6. Encrypts the certificate password as a vault reference
     * 7. Saves certificate metadata (not keys) to MongoDB
     *
     * @throws KsefCertificateException if the file is invalid, password is wrong,
     *                                  or file too large
     */
    public KsefCertificate storeCertificate(
            byte[] pfxBytes,
            String tenantId,
            String fileName,
            String password,
            String uploadedByUserId) {

        if (pfxBytes.length > props.getMaxFileSize()) {
            throw new KsefCertificateException(
                    "Certificate file exceeds maximum allowed size of " + props.getMaxFileSize() + " bytes");
        }

        // Validate and extract metadata before touching any stored state
        KeyStore keyStore = KeyStoreUtils.loadKeyStoreFromBytes(pfxBytes, password);
        X509Certificate x509 = KeyStoreUtils.extractX509Certificate(keyStore);

        // Deactivate existing active cert — only one active cert per tenant at any time
        certificateRepository.findByTenantIdAndActiveTrue(tenantId)
                .ifPresent(existing -> {
                    existing.setActive(false);
                    existing.setUpdatedAt(LocalDateTime.now());
                    certificateRepository.save(existing);
                    log.info("Deactivated previous certificate [id={}] for tenant [{}]",
                            existing.getId(), tenantId);
                });

        String storagePath = storage.writePfxEncrypted(tenantId, pfxBytes, fileName);
        String vaultRef = crypto.encryptPassword(password);

        KsefCertificate cert = KsefCertificate.builder()
                .tenantId(tenantId)
                .fileName(fileName)
                .type(KsefCertificateType.PFX)
                .issuedTo(x509.getSubjectX500Principal().getName())
                .issuer(x509.getIssuerX500Principal().getName())
                .validFrom(KeyStoreUtils.toLocalDate(x509.getNotBefore()))
                .validTo(KeyStoreUtils.toLocalDate(x509.getNotAfter()))
                .verificationStatus(KsefCertificateVerificationStatus.VERIFIED)
                .vaultPasswordReference(vaultRef)
                .encryptedStoragePath(storagePath)
                .uploadedByUserId(uploadedByUserId)
                .active(true)
                .createdAt(LocalDateTime.now())
                .build();

        KsefCertificate saved = certificateRepository.save(cert);
        log.info("Stored certificate [id={}] for tenant [{}], validTo={}",
                saved.getId(), tenantId, saved.getValidTo());
        return saved;
    }

    /**
     * Gets the private key from the tenant's active certificate.
     *
     * What this method does:
     * 1. Finds the tenant's active certificate
     * 2. Checks if the certificate is expired
     * 3. Decrypts the stored .pfx certificate file
     * 4. Decrypts the certificate password
     * 5. Loads the .pfx file into memory
     * 6. Extracts and returns the private key
     *
     * The private key is only decrypted temporarily in memory
     * and is never permanently stored or cached.
     *
     * Used by:
     * - KSeFAuthService to digitally sign KSeF authentication requests
     *
     * @throws KsefCertificateException if:
     *                                  - no active certificate exists,
     *                                  - the certificate is expired,
     *                                  - or decryption/loading fails
     */
    public PrivateKey getPrivateKey(String tenantId) {
        KsefCertificate cert = getActiveCertOrThrow(tenantId);
        validateNotExpired(cert);

        byte[] pfxBytes = storage.readPfxDecrypted(cert.getEncryptedStoragePath());
        String password = crypto.decryptPassword(cert.getVaultPasswordReference());

        KeyStore keyStore = KeyStoreUtils.loadKeyStoreFromBytes(pfxBytes, password);
        return KeyStoreUtils.extractPrivateKey(keyStore, password);
    }

    /**
     * Gets the public X509 certificate from the tenant's active certificate.
     *
     * What this method does:
     * 1. Finds the tenant's active certificate
     * 2. Decrypts the stored .pfx certificate file
     * 3. Decrypts the certificate password
     * 4. Loads the .pfx file into memory
     * 5. Extracts and returns the public X509 certificate
     *
     * Used by:
     * - KSeFAuthService to send the public certificate
     * during KSeF authentication requests
     *
     * Security:
     * - The .pfx file stays encrypted in storage
     * - Decryption happens only temporarily in memory
     *
     * @throws KsefCertificateException if:
     *                                  - no active certificate exists,
     *                                  - or certificate loading/decryption fails
     */
    public X509Certificate getPublicCertificate(String tenantId) {
        KsefCertificate cert = getActiveCertOrThrow(tenantId);

        byte[] pfxBytes = storage.readPfxDecrypted(cert.getEncryptedStoragePath());
        String password = crypto.decryptPassword(cert.getVaultPasswordReference());

        KeyStore keyStore = KeyStoreUtils.loadKeyStoreFromBytes(pfxBytes, password);
        return KeyStoreUtils.extractX509Certificate(keyStore);
    }

    /**
     * Checks whether the tenant's active certificate can be used for KSeF
     * authentication.
     *
     * What this method does:
     * 1. Finds the tenant's active certificate
     * 2. Checks if the certificate is expired
     * 3. Checks if the certificate has been revoked
     * 4. Allows usage only if the certificate is valid and active
     *
     * Used by:
     * - KSeFAuthService before opening a session with KSeF
     *
     * Security:
     * - Prevents expired or revoked certificates from being used
     * - Ensures only valid certificates can sign KSeF requests
     *
     * @throws KsefCertificateException if:
     *                                  - no active certificate exists,
     *                                  - the certificate is expired,
     *                                  - or the certificate has been revoked
     */
    public void validateCertificateActive(String tenantId) {
        KsefCertificate cert = getActiveCertOrThrow(tenantId);
        validateNotExpired(cert);

        if (cert.getVerificationStatus() == KsefCertificateVerificationStatus.REVOKED) {
            throw new KsefCertificateException(
                    "Certificate [" + cert.getId() + "] has been revoked and cannot be used");
        }
        if (cert.getVerificationStatus() == KsefCertificateVerificationStatus.EXPIRED) {
            throw new KsefCertificateException(
                    "Certificate [" + cert.getId() + "] is marked as expired");
        }
    }

    /**
     * Returns all certificates uploaded by a tenant.
     *
     * What this method does:
     * 1. Finds all certificates belonging to the tenant
     * 2. Sorts them by upload date (newest first)
     * 3. Returns the certificate list
     *
     * Used by:
     * - Certificate Manager UI
     * - Admin or settings screens where users can view certificate history
     *
     * Example:
     * - Active certificate
     * - Old/inactive certificates
     * - Expired certificates
     *
     * @return list of tenant certificates ordered by latest upload first
     */
    public List<KsefCertificate> listCertificates(String tenantId) {
        return certificateRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    /**
     * Deactivates a specific certificate for a tenant.
     *
     * What this method does:
     * 1. Finds the certificate by its ID
     * 2. Verifies that the certificate belongs to the correct tenant
     * 3. Marks the certificate as inactive
     * 4. Updates the modified timestamp
     * 5. Saves the updated certificate in MongoDB
     *
     * Used by:
     * - Certificate Manager UI
     * - Admin settings when disabling a certificate manually
     *
     * Security:
     * - Prevents one tenant from modifying another tenant's certificate
     *
     * Example:
     * - Active certificate → inactive
     *
     * @throws KsefCertificateException if:
     *                                  - the certificate does not exist,
     *                                  - or the certificate belongs to another
     *                                  tenant
     */
    public void deactivateCertificate(String tenantId, String certId) {
        KsefCertificate cert = certificateRepository.findById(certId)
                .orElseThrow(() -> new KsefCertificateException(
                        "Certificate not found: " + certId));

        if (!cert.getTenantId().equals(tenantId)) {
            throw new KsefCertificateException(
                    "Certificate [" + certId + "] does not belong to tenant [" + tenantId + "]");
        }

        cert.setActive(false);
        cert.setUpdatedAt(LocalDateTime.now());
        certificateRepository.save(cert);
        log.info("Manually deactivated certificate [id={}] for tenant [{}]", certId, tenantId);
    }

    /**
     * Records a successful KSeF authentication for the tenant's active certificate.
     *
     * What this method does:
     * 1. Finds the tenant's active certificate
     * 2. Increases the successful authentication count
     * 3. Stores the latest successful authentication time
     * 4. Updates the modified timestamp
     * 5. Saves the updated certificate information in MongoDB
     *
     * Used by:
     * - KSeFAuthService after successfully opening a KSeF session
     *
     * Purpose:
     * - Tracks certificate usage history
     * - Helps monitor successful KSeF authentications
     * - Useful for auditing and analytics
     *
     * Example:
     * authSuccessCount: 5 → 6
     */
    /**
     * Records a successful KSeF authentication against the active certificate.
     * Called by KSeFAuthService after a session is successfully opened.
     */
    public void recordAuthSuccess(String tenantId) {
        certificateRepository.findByTenantIdAndActiveTrue(tenantId).ifPresent(cert -> {
            cert.setAuthSuccessCount(cert.getAuthSuccessCount() + 1);
            cert.setLastAuthTime(LocalDateTime.now());
            cert.setUpdatedAt(LocalDateTime.now());
            certificateRepository.save(cert);
        });
    }

    /**
     * Records a failed KSeF authentication attempt for the tenant's active
     * certificate.
     *
     * What this method does:
     * 1. Finds the tenant's active certificate
     * 2. Increases the failed authentication count
     * 3. Updates the modified timestamp
     * 4. Saves the updated certificate information in MongoDB
     *
     * Used by:
     * - KSeFAuthService when KSeF authentication fails
     * - Challenge-response signing fails
     * - Session opening fails
     *
     * Purpose:
     * - Tracks failed authentication attempts
     * - Helps monitor certificate issues
     * - Useful for debugging, auditing, and security monitoring
     *
     * Example:
     * authFailureCount: 2 → 3
     */
    public void recordAuthFailure(String tenantId) {
        certificateRepository.findByTenantIdAndActiveTrue(tenantId).ifPresent(cert -> {
            cert.setAuthFailureCount(cert.getAuthFailureCount() + 1);
            cert.setUpdatedAt(LocalDateTime.now());
            certificateRepository.save(cert);
        });
    }

    // private ── Domain-level guards (stay in service — they operate on the domain model)

    /**
     * Finds and returns the tenant's currently active certificate.
     *
     * What this method does:
     * 1. Searches for the tenant's active certificate
     * 2. Returns the certificate if found
     * 3. Throws an exception if no active certificate exists
     *
     * Purpose:
     * - Ensures the tenant has a valid active certificate before using KSeF
     * features
     *
     * Used by:
     * - Authentication
     * - Invoice signing
     * - Certificate validation
     *
     * @throws KsefCertificateException if no active certificate is found
     */
    private KsefCertificate getActiveCertOrThrow(String tenantId) {
        return certificateRepository.findByTenantIdAndActiveTrue(tenantId)
                .orElseThrow(() -> new KsefCertificateException(
                        "No active certificate found for tenant: " + tenantId
                                + ". Upload a .pfx certificate before sending invoices."));
    }

    /**
     * Checks whether the certificate is expired.
     *
     * What this method does:
     * 1. Reads the certificate expiry date
     * 2. Compares it with the current date
     * 3. Throws an exception if the certificate has expired
     *
     * Purpose:
     * - Prevents expired certificates from being used for KSeF authentication
     * - Ensures invoices are signed only with valid certificates
     *
     * Example:
     * Certificate validTo = 2026-01-01
     * Current date = 2026-02-01
     * → Certificate is expired
     *
     * @throws KsefCertificateException if the certificate is expired
     */
    private void validateNotExpired(KsefCertificate cert) {
        if (cert.getValidTo() != null && cert.getValidTo().isBefore(LocalDate.now())) {
            throw new KsefCertificateException(
                    "Certificate [" + cert.getId() + "] expired on " + cert.getValidTo()
                            + ". Upload a new certificate to resume invoice submissions.");
        }
    }
}
