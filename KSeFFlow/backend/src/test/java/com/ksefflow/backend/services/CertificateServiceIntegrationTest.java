package com.ksefflow.backend.services;

import com.ksefflow.backend.services.certificate.CertificateService;

import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.utils.KsefCertificateVerificationStatus;
import com.ksefflow.backend.repository.KsefCertificateRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.io.InputStream;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

// Full integration test — runs against a real MongoDB instance.
// Requires: MongoDB on localhost:27017 (or MONGODB_URI env var set).
// Uses the dev profile so ksef.cert.encryption-key defaults to all-zeros (safe for tests).
@SpringBootTest
@ActiveProfiles("dev")
class CertificateServiceIntegrationTest {

    private static final String TEST_TENANT  = "test-tenant-001";
    private static final String TEST_USER_ID = "test-user-001";
    private static final String PFX_PASSWORD = "KSeFTest2024!";
    private static final String PFX_FILENAME = "ksefflow_sandbox_test.pfx";

    @Autowired
    private CertificateService certificateService;

    @Autowired
    private KsefCertificateRepository certificateRepository;

    // Clean up test data before and after each test so tests are independent
    @BeforeEach
    @AfterEach
    void cleanup() {
        certificateRepository.findByTenantIdOrderByCreatedAtDesc(TEST_TENANT)
                .forEach(cert -> certificateRepository.delete(cert));
    }

    // ── Phase 1 Tests ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("storeCertificate: valid .pfx is accepted, encrypted, and saved to MongoDB")
    void storeCertificate_validPfx_savesMetadataToMongo() throws Exception {
        byte[] pfxBytes = loadTestPfx();

        KsefCertificate saved = certificateService.storeCertificate(
                pfxBytes, TEST_TENANT, PFX_FILENAME, PFX_PASSWORD, TEST_USER_ID);

        // MongoDB document exists and has the right metadata
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getTenantId()).isEqualTo(TEST_TENANT);
        assertThat(saved.getFileName()).isEqualTo(PFX_FILENAME);
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getVerificationStatus()).isEqualTo(KsefCertificateVerificationStatus.VERIFIED);

        // Subject and issuer are read from the actual certificate
        assertThat(saved.getIssuedTo()).contains("KSeFFlow Test");

        // Validity dates exist
        assertThat(saved.getValidFrom()).isNotNull();
        assertThat(saved.getValidTo()).isNotNull();

        // Storage path exists (the encrypted file was written)
        assertThat(saved.getEncryptedStoragePath()).isNotNull();

        // Password reference is encrypted — starts with "local:" not the raw password
        assertThat(saved.getVaultPasswordReference()).startsWith("local:");
        assertThat(saved.getVaultPasswordReference()).doesNotContain(PFX_PASSWORD);
    }

    @Test
    @DisplayName("storeCertificate: wrong password throws KsefCertificateException before any DB write")
    void storeCertificate_wrongPassword_throwsBeforeDbWrite() throws Exception {
        byte[] pfxBytes = loadTestPfx();

        assertThatThrownBy(() ->
                certificateService.storeCertificate(
                        pfxBytes, TEST_TENANT, PFX_FILENAME, "WrongPassword!", TEST_USER_ID))
                .isInstanceOf(KsefCertificateException.class)
                .hasMessageContaining("Invalid .pfx file or wrong password");

        // Nothing was written to MongoDB
        List<KsefCertificate> certs = certificateRepository
                .findByTenantIdOrderByCreatedAtDesc(TEST_TENANT);
        assertThat(certs).isEmpty();
    }

    @Test
    @DisplayName("storeCertificate: uploading a second cert deactivates the first one")
    void storeCertificate_secondUpload_deactivatesPreviousCert() throws Exception {
        byte[] pfxBytes = loadTestPfx();

        // Upload first cert
        KsefCertificate first = certificateService.storeCertificate(
                pfxBytes, TEST_TENANT, "first.pfx", PFX_PASSWORD, TEST_USER_ID);
        assertThat(first.isActive()).isTrue();

        // Upload second cert
        KsefCertificate second = certificateService.storeCertificate(
                pfxBytes, TEST_TENANT, "second.pfx", PFX_PASSWORD, TEST_USER_ID);
        assertThat(second.isActive()).isTrue();

        // First cert is now inactive in MongoDB
        KsefCertificate reloadedFirst = certificateRepository.findById(first.getId()).orElseThrow();
        assertThat(reloadedFirst.isActive()).isFalse();
    }

    @Test
    @DisplayName("getPrivateKey: decrypts stored .pfx and returns a real RSA PrivateKey")
    void getPrivateKey_validCert_returnsRsaPrivateKey() throws Exception {
        certificateService.storeCertificate(
                loadTestPfx(), TEST_TENANT, PFX_FILENAME, PFX_PASSWORD, TEST_USER_ID);

        PrivateKey privateKey = certificateService.getPrivateKey(TEST_TENANT);

        assertThat(privateKey).isNotNull();
        assertThat(privateKey.getAlgorithm()).isEqualTo("RSA");
        assertThat(privateKey.getEncoded()).isNotEmpty();
    }

    @Test
    @DisplayName("getPublicCertificate: decrypts stored .pfx and returns a real X509Certificate")
    void getPublicCertificate_validCert_returnsX509() throws Exception {
        certificateService.storeCertificate(
                loadTestPfx(), TEST_TENANT, PFX_FILENAME, PFX_PASSWORD, TEST_USER_ID);

        X509Certificate cert = certificateService.getPublicCertificate(TEST_TENANT);

        assertThat(cert).isNotNull();
        assertThat(cert.getSubjectX500Principal().getName()).contains("KSeFFlow Test");
        assertThat(cert.getNotAfter()).isNotNull();
    }

    @Test
    @DisplayName("getPrivateKey: throws when no active cert exists for tenant")
    void getPrivateKey_noCert_throwsCertificateException() {
        assertThatThrownBy(() -> certificateService.getPrivateKey("unknown-tenant"))
                .isInstanceOf(KsefCertificateException.class)
                .hasMessageContaining("No active certificate found");
    }

    @Test
    @DisplayName("validateCertificateActive: passes for a freshly uploaded valid cert")
    void validateCertificateActive_validCert_doesNotThrow() throws Exception {
        certificateService.storeCertificate(
                loadTestPfx(), TEST_TENANT, PFX_FILENAME, PFX_PASSWORD, TEST_USER_ID);

        // Must not throw
        assertThatCode(() -> certificateService.validateCertificateActive(TEST_TENANT))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("listCertificates: returns all certs for the tenant in descending order")
    void listCertificates_afterTwoUploads_returnsBothDescending() throws Exception {
        byte[] pfxBytes = loadTestPfx();
        certificateService.storeCertificate(pfxBytes, TEST_TENANT, "first.pfx", PFX_PASSWORD, TEST_USER_ID);
        certificateService.storeCertificate(pfxBytes, TEST_TENANT, "second.pfx", PFX_PASSWORD, TEST_USER_ID);

        List<KsefCertificate> certs = certificateService.listCertificates(TEST_TENANT);

        assertThat(certs).hasSize(2);
        // Most recent first (second.pfx)
        assertThat(certs.get(0).getFileName()).isEqualTo("second.pfx");
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private byte[] loadTestPfx() throws Exception {
        // Loads the test .pfx from the classpath test resources
        // Copy ksef-certs/test-cert/ksefflow_sandbox_test.pfx → src/test/resources/
        try (InputStream is = getClass().getClassLoader()
                .getResourceAsStream("ksefflow_sandbox_test.pfx")) {
            if (is == null) {
                throw new IllegalStateException(
                        "Test .pfx not found in src/test/resources/. " +
                        "Copy KSeFFlow/backend/ksef-certs/test-cert/ksefflow_sandbox_test.pfx " +
                        "into KSeFFlow/backend/src/test/resources/");
            }
            return is.readAllBytes();
        }
    }
}
