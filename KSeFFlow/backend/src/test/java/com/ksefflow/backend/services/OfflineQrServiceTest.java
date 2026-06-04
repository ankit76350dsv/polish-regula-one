package com.ksefflow.backend.services;

import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.services.certificate.CertificateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.PSSParameterSpec;
import java.time.LocalDate;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

// Unit tests for the offline QR builder. Verify the exact MF URL formats and that the
// CODE II certificate seal is a valid signature over the spec-defined path.
@ExtendWith(MockitoExtension.class)
class OfflineQrServiceTest {

    private static final String BASE = "https://qr-test.ksef.mf.gov.pl";
    private static final String TENANT = "tenant-1";
    private static final String NIP = "1111111111";
    private static final String SERIAL = "01F20A5D352AE590";
    // 64 hex chars = 32-byte SHA-256
    private static final String HASH_HEX =
            "52d429f46a5ce75cbeb7b714005998c88e092967635be27c2a79522f6f165cc8";

    @Mock private CertificateService certificateService;

    @InjectMocks private OfflineQrService offlineQrService;

    private static KeyPair rsaKeyPair;

    @BeforeEach
    void setBaseUrl() {
        ReflectionTestUtils.setField(offlineQrService, "baseUrl", BASE);
    }

    private static String expectedHashBase64Url() {
        byte[] bytes = new byte[HASH_HEX.length() / 2];
        for (int i = 0; i < HASH_HEX.length(); i += 2) {
            bytes[i / 2] = (byte) Integer.parseInt(HASH_HEX.substring(i, i + 2), 16);
        }
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static KsefInvoice invoice() {
        KsefInvoice inv = new KsefInvoice();
        inv.setTenantId(TENANT);
        inv.setSellerNip(NIP);
        inv.setInvoiceNumber("FV/2026/02/0001");
        inv.setIssueDate(LocalDate.of(2026, 2, 1));
        inv.setTotalGross(new BigDecimal("123.45"));
        inv.setFa3XmlHash(HASH_HEX);
        return inv;
    }

    @Test
    @DisplayName("CODE I: builds the exact MF /invoice/{NIP}/{DD-MM-YYYY}/{Base64URL-SHA256} URL")
    void codeI_matchesMfFormat() {
        String url = offlineQrService.generateInvoiceCode(invoice());

        assertThat(url).isEqualTo(
                BASE + "/invoice/" + NIP + "/01-02-2026/" + expectedHashBase64Url());
    }

    @Test
    @DisplayName("CODE II: builds the /certificate/... URL and the seal verifies against the public key")
    void codeII_signatureVerifies() throws Exception {
        KeyPair kp = rsaKeyPair();
        KsefCertificate cert = new KsefCertificate();
        cert.setCertificateSerialNumber(SERIAL);

        when(certificateService.getActiveOfflineCert(TENANT)).thenReturn(cert);
        when(certificateService.getOfflineSealPrivateKey(TENANT)).thenReturn(kp.getPrivate());

        String url = offlineQrService.generateCertificateCode(invoice());

        String hash = expectedHashBase64Url();
        String prefix = BASE + "/certificate/Nip/" + NIP + "/" + NIP + "/" + SERIAL + "/" + hash + "/";
        assertThat(url).startsWith(prefix);

        // The signature is the final path segment; it must verify (RSASSA-PSS, SHA-256)
        // over the path WITHOUT the scheme and WITHOUT the trailing /{signature}.
        String signatureB64Url = url.substring(prefix.length());
        byte[] signature = Base64.getUrlDecoder().decode(signatureB64Url);

        String signedPath = "qr-test.ksef.mf.gov.pl/certificate/Nip/"
                + NIP + "/" + NIP + "/" + SERIAL + "/" + hash;

        assertThat(verifyPss(kp.getPublic(), signedPath, signature)).isTrue();
        // A tampered path must NOT verify.
        assertThat(verifyPss(kp.getPublic(), signedPath + "X", signature)).isFalse();
    }

    @Test
    @DisplayName("CODE II: throws an explicit compliance error when no OFFLINE certificate exists")
    void codeII_noOfflineCert_throws() {
        when(certificateService.getActiveOfflineCert(TENANT))
                .thenThrow(new KsefCertificateException("No active OFFLINE-type KSeF certificate"));

        assertThatThrownBy(() -> offlineQrService.generateCertificateCode(invoice()))
                .isInstanceOf(KsefCertificateException.class)
                .hasMessageContaining("OFFLINE");
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private static synchronized KeyPair rsaKeyPair() throws Exception {
        if (rsaKeyPair == null) {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
            gen.initialize(2048);
            rsaKeyPair = gen.generateKeyPair();
        }
        return rsaKeyPair;
    }

    private static boolean verifyPss(PublicKey pub, String data, byte[] signature) throws Exception {
        Signature sig = Signature.getInstance("RSASSA-PSS");
        sig.setParameter(new PSSParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, 32, 1));
        sig.initVerify(pub);
        sig.update(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return sig.verify(signature);
    }
}
