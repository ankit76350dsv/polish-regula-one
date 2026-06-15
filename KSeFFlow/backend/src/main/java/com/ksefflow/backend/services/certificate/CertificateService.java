package com.ksefflow.backend.services.certificate;

import com.ksefflow.backend.config.CertificateStorageProperties;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.utils.KsefCertificatePurpose;
import com.ksefflow.backend.models.utils.KsefCertificateType;
import com.ksefflow.backend.models.utils.KsefCertificateVerificationStatus;
import com.ksefflow.backend.repository.KsefCertificateRepository;
import com.ksefflow.backend.services.KSeFAuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.CertificateFactory;
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
        private final KsefCertificateRepository ksef_certificates_repo;
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
                                        "Certificate file exceeds maximum allowed size of " + props.getMaxFileSize()
                                                        + " bytes");
                }

                // ! Validate and extract metadata before touching any stored state
                KeyStore keyStore = KeyStoreUtils.loadKeyStoreFromBytes(pfxBytes, password);
                // ! get the certificate from the store...
                X509Certificate x509 = KeyStoreUtils.extractX509Certificate(keyStore); // ! A certificate is basically a
                                                                                       // digital
                                                                                       // identity card used on
                                                                                       // computers and
                                                                                       // the internet.
                                                                                       // ! Government authority
                                                                                       // Certificate
                                                                                       // Authority (CA)

                // Deactivate existing active cert — only one active cert per tenant at any time
                ksef_certificates_repo.findByTenantIdAndActiveTrue(tenantId)
                                .ifPresent(existing -> {
                                        existing.setActive(false);
                                        existing.setUpdatedAt(LocalDateTime.now());
                                        ksef_certificates_repo.save(existing);
                                        log.info("[storeCertificate]:1 Deactivated previous certificate [id={}] for tenant [{}]",
                                                        existing.getId(), tenantId);
                                });

                // encrypt and store the encrypt file and return the storage path...
                String storagePath = storage.writePfxEncrypted(tenantId, pfxBytes, fileName);
                // just retunr the encrypt password...
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

                KsefCertificate saved = ksef_certificates_repo.save(cert);
                log.info("[storeCertificate]:2 Stored certificate [id={}] for tenant [{}], validTo={}",
                                saved.getId(), tenantId, saved.getValidTo());

                writeAuditLog(tenantId, "CERTIFICATE_UPLOADED", saved.getId(), uploadedByUserId,
                                describeCertificate(saved));
                return saved;
        }

        /**
         * Stores a KSeF-ISSUED certificate (gap C3) that we obtained via the enrollment API.
         *
         * Unlike {@link #storeCertificate} (which takes a .pfx the user uploaded), this method is
         * for a certificate KSeF generated for us: the caller has already packaged our locally
         * generated private key together with the issued public certificate into a PKCS12 (.p12)
         * byte array. We then store it through the exact same encrypted pipeline (S3 + AES-256-GCM
         * file, encrypted password) so there is ONE storage path for all certificates.
         *
         * Differences from a user upload:
         *   - we record the certificate PURPOSE (AUTHENTICATION vs OFFLINE), because KSeF issues
         *     a distinct certificate for each, and a tenant may hold one active certificate of
         *     EACH purpose at the same time — so we only deactivate the previous active cert of
         *     the SAME purpose, not all of them;
         *   - we record the KSeF certificate serial number returned by enrollment.
         *
         * @param pfxBytes         PKCS12 bytes = our private key + the issued public certificate
         * @param purpose          AUTHENTICATION (log in) or OFFLINE (seal offline invoices)
         * @param ksefSerialNumber the certificate serial number KSeF assigned
         */
        public KsefCertificate storeEnrolledCertificate(
                        byte[] pfxBytes,
                        String tenantId,
                        String fileName,
                        String password,
                        String uploadedByUserId,
                        KsefCertificatePurpose purpose,
                        String ksefSerialNumber) {

                if (pfxBytes.length > props.getMaxFileSize()) {
                        throw new KsefCertificateException(
                                        "Certificate file exceeds maximum allowed size of " + props.getMaxFileSize()
                                                        + " bytes");
                }

                // Validate the package and read identity details before writing any stored state.
                KeyStore keyStore = KeyStoreUtils.loadKeyStoreFromBytes(pfxBytes, password);
                X509Certificate x509 = KeyStoreUtils.extractX509Certificate(keyStore);

                // Deactivate the previous active certificate of the SAME purpose only.
                ksef_certificates_repo.findByTenantIdAndPurposeAndActiveTrue(tenantId, purpose)
                                .ifPresent(existing -> {
                                        existing.setActive(false);
                                        existing.setUpdatedAt(LocalDateTime.now());
                                        ksef_certificates_repo.save(existing);
                                        log.info("[storeEnrolledCertificate]:1 Deactivated previous [{}] certificate [id={}] for tenant [{}]",
                                                        purpose, existing.getId(), tenantId);
                                });

                String storagePath = storage.writePfxEncrypted(tenantId, pfxBytes, fileName);
                String vaultRef = crypto.encryptPassword(password);

                KsefCertificate cert = KsefCertificate.builder()
                                .tenantId(tenantId)
                                .fileName(fileName)
                                .type(KsefCertificateType.PFX)
                                .purpose(purpose)
                                .certificateSerialNumber(ksefSerialNumber)
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

                KsefCertificate saved = ksef_certificates_repo.save(cert);
                log.info("[storeEnrolledCertificate]:2 Stored KSeF-issued [{}] certificate [id={}] serial [{}] for tenant [{}]",
                                purpose, saved.getId(), ksefSerialNumber, tenantId);

                writeAuditLog(tenantId, "CERTIFICATE_ENROLLED", saved.getId(), uploadedByUserId,
                                describeCertificate(saved));
                return saved;
        }

        /**
         * Returns the private key from the tenant's active certificate.
         * Decrypts the .pfx file and password temporarily in memory.
         *
         * @throws KsefCertificateException if certificate is missing,
         *                                  expired, or loading fails
         */
        public PrivateKey getPrivateKey(String tenantId) {
                log.info("[getPrivateKey]:1 Loading active signing private key for tenant [{}]", tenantId);
                KsefCertificate certInfo = getActiveCertOrThrow(tenantId);
                validateNotExpired(certInfo);

                byte[] pfxBytes = storage.readPfxDecrypted(certInfo.getEncryptedStoragePath());
                String password = crypto.decryptPassword(certInfo.getVaultPasswordReference());

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
                log.info("[getPublicCertificate]:1 Loading active public certificate for tenant [{}]", tenantId);
                KsefCertificate cert = getActiveCertOrThrow(tenantId);

                byte[] pfxBytes = storage.readPfxDecrypted(cert.getEncryptedStoragePath());
                String password = crypto.decryptPassword(cert.getVaultPasswordReference());

                KeyStore keyStore = KeyStoreUtils.loadKeyStoreFromBytes(pfxBytes, password);
                return KeyStoreUtils.extractX509Certificate(keyStore);
        }

        // ── Offline-sealing certificate (KSeF Code II) ──────────────────────────────
        //
        // Per the MF spec (certyfikaty-KSeF.md), the offline QR Code II ("CERTYFIKAT")
        // MUST be sealed with an OFFLINE-purpose KSeF certificate (KeyUsage Non-Repudiation).
        // The AUTHENTICATION certificate must NEVER be substituted. These methods select
        // the OFFLINE certificate explicitly and FAIL LOUDLY (no fallback) when none exists,
        // so we never produce a non-compliant seal.

        /**
         * Returns the tenant's active OFFLINE-purpose certificate metadata (incl. its KSeF
         * certificateSerialNumber for the QR), or throws an explicit compliance error.
         */
        public KsefCertificate getActiveOfflineCert(String tenantId) {
                log.info("[getActiveOfflineCert]:1 Loading active OFFLINE certificate for tenant [{}]", tenantId);
                return getActiveOfflineCertOrThrow(tenantId);
        }

        /**
         * Returns the private key of the tenant's active OFFLINE-purpose certificate,
         * used to sign the offline QR Code II. Throws if no OFFLINE certificate is provisioned.
         */
        public PrivateKey getOfflineSealPrivateKey(String tenantId) {
                log.info("[getOfflineSealPrivateKey]:1 Loading OFFLINE seal private key for tenant [{}]", tenantId);
                KsefCertificate certInfo = getActiveOfflineCertOrThrow(tenantId);
                validateNotExpired(certInfo);

                byte[] pfxBytes = storage.readPfxDecrypted(certInfo.getEncryptedStoragePath());
                String password = crypto.decryptPassword(certInfo.getVaultPasswordReference());

                KeyStore keyStore = KeyStoreUtils.loadKeyStoreFromBytes(pfxBytes, password);
                return KeyStoreUtils.extractPrivateKey(keyStore, password);
        }

        // Looks up the active OFFLINE-purpose certificate; throws a clear, compliance-oriented
        // error when absent (a prerequisite for issuing offline invoices under the MF rules).
        private KsefCertificate getActiveOfflineCertOrThrow(String tenantId) {
                return ksef_certificates_repo
                                .findByTenantIdAndPurposeAndActiveTrue(tenantId, KsefCertificatePurpose.OFFLINE)
                                .orElseThrow(() -> new KsefCertificateException(
                                                "No active OFFLINE-type KSeF certificate for tenant " + tenantId
                                                                + ". The offline QR Code II ('CERTYFIKAT') can only be sealed with a"
                                                                + " dedicated OFFLINE KSeF certificate (Non-Repudiation), which must be"
                                                                + " enrolled via KSeF (POST /certificates/enrollments). The authentication"
                                                                + " certificate must NOT be used. Provision an OFFLINE certificate before"
                                                                + " issuing invoices in offline mode."));
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

                log.info("[validateCertificateActive]:1 Validating active certificate for tenant [{}]",
                                tenantId);

                KsefCertificate cert = getActiveCertOrThrow(tenantId);

                log.debug("[validateCertificateActive]:2 Active certificate found for tenant [{}] — certificateId [{}]",
                                tenantId,
                                cert.getId());

                validateNotExpired(cert);

                log.debug("[validateCertificateActive]:3 Certificate expiry validation passed for certificate [{}]",
                                cert.getId());

                if (cert.getVerificationStatus() == KsefCertificateVerificationStatus.REVOKED) {
                        log.error("[validateCertificateActive]:4 Certificate [{}] is revoked and cannot be used",
                                        cert.getId());
                        throw new KsefCertificateException(
                                        "Certificate [" + cert.getId() + "] has been revoked and cannot be used");
                }

                if (cert.getVerificationStatus() == KsefCertificateVerificationStatus.EXPIRED) {
                        log.error("[validateCertificateActive]:5 Certificate [{}] is marked as expired",
                                        cert.getId());
                        throw new KsefCertificateException(
                                        "Certificate [" + cert.getId() + "] is marked as expired");
                }

                log.info("[validateCertificateActive]:6 Certificate validation completed successfully for tenant [{}]",
                                tenantId);
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
                log.info("[listCertificates]:1 Listing certificates for tenant [{}]", tenantId);
                return ksef_certificates_repo.findByTenantIdOrderByCreatedAtDesc(tenantId);
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
                KsefCertificate cert = ksef_certificates_repo.findById(certId)
                                .orElseThrow(() -> new KsefCertificateException(
                                                "Certificate not found: " + certId));

                if (!cert.getTenantId().equals(tenantId)) {
                        throw new KsefCertificateException(
                                        "Certificate [" + certId + "] does not belong to tenant [" + tenantId + "]");
                }

                cert.setActive(false);
                cert.setUpdatedAt(LocalDateTime.now());
                ksef_certificates_repo.save(cert);
                log.info("[deactivateCertificate]:1 Manually deactivated certificate [id={}] for tenant [{}]", certId, tenantId);

                writeAuditLog(tenantId, "CERTIFICATE_DEACTIVATED", cert.getId(),
                                cert.getUploadedByUserId(), describeCertificate(cert));
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
                log.info("[recordAuthSuccess]:1 Recording successful auth on active cert for tenant [{}]", tenantId);
                ksef_certificates_repo.findByTenantIdAndActiveTrue(tenantId).ifPresent(cert -> {
                        cert.setAuthSuccessCount(cert.getAuthSuccessCount() + 1);
                        cert.setLastAuthTime(LocalDateTime.now());
                        cert.setUpdatedAt(LocalDateTime.now());
                        ksef_certificates_repo.save(cert);
                });
        }

        /**
         * Increases failed auth count for tenant's active certificate
         * and updates it in MongoDB.
         * Example:
         * authFailureCount: 2 → 3
         */
        public void recordAuthFailure(String tenantId) {
                log.info("[recordAuthFailure]:1 Recording failed auth on active cert for tenant [{}]", tenantId);
                ksef_certificates_repo.findByTenantIdAndActiveTrue(tenantId).ifPresent(cert -> {
                        cert.setAuthFailureCount(cert.getAuthFailureCount() + 1);
                        cert.setUpdatedAt(LocalDateTime.now());
                        ksef_certificates_repo.save(cert);
                });
        }

        /**
         * Uploads and securely stores a PEM-encoded certificate for a tenant.
         *
         * PEM files (.pem / .crt) contain a base64-encoded DER certificate between
         * -----BEGIN CERTIFICATE----- / -----END CERTIFICATE----- markers.
         * Unlike PFX, a standalone PEM certificate file does NOT contain a private key
         * —
         * it is used only for public certificate operations (e.g. trusting a CA or
         * presenting a server certificate). KSeF signing still requires a PFX.
         *
         * What this method does:
         * 1. Checks the uploaded file is within the size limit
         * 2. Parses the PEM bytes with CertificateFactory to validate format and
         * extract X.509 metadata (subject, issuer, validity dates)
         * 3. Deactivates the current active PEM certificate for the tenant (if any)
         * 4. AES-256-GCM encrypts and stores the raw PEM bytes
         * 5. Saves certificate metadata to MongoDB — no private key material stored
         *
         * @param pemBytes         Raw bytes of the .pem / .crt file
         * @param tenantId         Tenant that owns this certificate
         * @param fileName         Original uploaded filename (e.g. "company_cert.pem")
         * @param uploadedByUserId MongoDB user._id of the uploading admin
         * @throws KsefCertificateException if the file is too large or not a valid PEM
         *                                  certificate
         */
        public KsefCertificate storePemCertificate(
                        byte[] pemBytes,
                        String tenantId,
                        String fileName,
                        String uploadedByUserId) {

                if (pemBytes.length > props.getMaxFileSize()) {
                        throw new KsefCertificateException(
                                        "Certificate file exceeds maximum allowed size of " + props.getMaxFileSize()
                                                        + " bytes");
                }

                // Validate and extract metadata before touching any stored state
                X509Certificate x509;
                try {
                        CertificateFactory cf = CertificateFactory.getInstance("X.509");
                        x509 = (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(pemBytes));
                } catch (Exception e) {
                        throw new KsefCertificateException(
                                        "Invalid PEM certificate: " + e.getMessage(), e);
                }

                // Deactivate existing active PEM cert for this tenant
                ksef_certificates_repo.findByTenantIdAndActiveTrue(tenantId)
                                .ifPresent(existing -> {
                                        existing.setActive(false);
                                        existing.setUpdatedAt(LocalDateTime.now());
                                        ksef_certificates_repo.save(existing);
                                        log.info("[storePemCertificate]:1 Deactivated previous PEM certificate [id={}] for tenant [{}]",
                                                        existing.getId(), tenantId);
                                });

                // Encrypt and persist the raw PEM bytes (same AES-256-GCM storage as PFX)
                String storagePath = storage.writePfxEncrypted(tenantId, pemBytes, fileName);

                KsefCertificate cert = KsefCertificate.builder()
                                .tenantId(tenantId)
                                .fileName(fileName)
                                .type(KsefCertificateType.PEM)
                                .issuedTo(x509.getSubjectX500Principal().getName())
                                .issuer(x509.getIssuerX500Principal().getName())
                                .validFrom(KeyStoreUtils.toLocalDate(x509.getNotBefore()))
                                .validTo(KeyStoreUtils.toLocalDate(x509.getNotAfter()))
                                .verificationStatus(KsefCertificateVerificationStatus.VERIFIED)
                                // PEM-only certificates carry no private key and need no vault password
                                // reference
                                .vaultPasswordReference(null)
                                .encryptedStoragePath(storagePath)
                                .uploadedByUserId(uploadedByUserId)
                                .active(true)
                                .createdAt(LocalDateTime.now())
                                .build();

                KsefCertificate saved = ksef_certificates_repo.save(cert);
                log.info("[storePemCertificate]:2 Stored PEM certificate [id={}] for tenant [{}], validTo={}",
                                saved.getId(), tenantId, saved.getValidTo());

                writeAuditLog(tenantId, "CERTIFICATE_UPLOADED", saved.getId(), uploadedByUserId,
                                describeCertificate(saved));
                return saved;
        }

        // private ── Domain-level guards (stay in service — they operate on the domain
        // model)

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
                return ksef_certificates_repo.findByTenantIdAndActiveTrue(tenantId)
                                .orElseThrow(() -> new KsefCertificateException(
                                                "No active certificate found for tenant: " + tenantId
                                                                + ". Upload a .pfx certificate before sending invoices."));
        }

        /**
         * Checks whether the certificate is expired.
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

        // ── Audit logging ───────────────────────────────────────────────────────────

        /**
         * Writes an immutable CERTIFICATE audit log entry via the shared
         * {@link AuditLog}
         * service. Uses the entity-type-aware overload so the entry is correctly tagged
         * "CERTIFICATE" rather than the default "INVOICE".
         *
         * Security: {@code newValue} carries only non-sensitive descriptive metadata —
         * NEVER the certificate password, vault reference, or any key material.
         * AuditLog swallows and logs any persistence failure so it never blocks the
         * underlying certificate operation.
         *
         * @param tenantId tenant that owns the certificate (mandatory tenant scope)
         * @param action   action code e.g. CERTIFICATE_UPLOADED,
         *                 CERTIFICATE_DEACTIVATED
         * @param certId   MongoDB _id of the affected certificate
         * @param userId   User._id of the actor who triggered the action (nullable)
         * @param newValue human-readable, non-sensitive description of the certificate
         */
        private void writeAuditLog(String tenantId, String action, String certId,
                        String userId, String newValue) {
                // The AuditLog service tracks the actor by email; at the certificate service
                // layer we only have the user id, so it is folded into the description.
                String detail = userId != null ? "userId=" + userId + ", " + newValue : newValue;
                KSeFAuditLogService.writeAuditLog(tenantId, action, "CERTIFICATE", certId, null, detail, null, null);
        }

        /**
         * Builds a non-sensitive one-line description of a certificate for the audit
         * trail. Deliberately excludes the password, vault reference, and storage path.
         */
        private String describeCertificate(KsefCertificate cert) {
                return String.format(
                                "fileName=%s, type=%s, issuedTo=%s, issuer=%s, validFrom=%s, validTo=%s, status=%s, active=%s",
                                cert.getFileName(), cert.getType(), cert.getIssuedTo(), cert.getIssuer(),
                                cert.getValidFrom(), cert.getValidTo(), cert.getVerificationStatus(), cert.isActive());
        }
}
