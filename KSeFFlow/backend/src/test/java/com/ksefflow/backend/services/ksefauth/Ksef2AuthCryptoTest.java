package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.dto.ksefapi.EncryptionInfo;
import com.ksefflow.backend.exceptions.KsefAuthException;
import com.ksefflow.backend.services.certificate.KeyStoreUtils;
import org.apache.xml.security.signature.XMLSignature;
import org.apache.xml.security.utils.Constants;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.security.spec.MGF1ParameterSpec;
import java.util.Base64;

import static org.assertj.core.api.Assertions.*;

/**
 * Verifies the deterministic KSeF 2.0 crypto: the AuthTokenRequest structure, that the
 * XAdES enveloped signature actually validates, and that the session AES/RSA-OAEP
 * encryption round-trips. Uses the test PKCS#12 keypair as both the signing key and a
 * stand-in for the KSeF public key (it carries a matching RSA keypair).
 */
class Ksef2AuthCryptoTest {

    private static final String PFX = "ksefflow_sandbox_test.pfx";
    private static final String PFX_PASSWORD = "KSeFTest2024!";
    private static final String CHALLENGE = "20260608-CR-AB12CD34EF-1122334455-AB";
    private static final String NIP = "1234567890";

    private static PrivateKey privateKey;
    private static X509Certificate certificate;

    @BeforeAll
    static void loadKeys() throws Exception {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (InputStream is = Ksef2AuthCryptoTest.class.getClassLoader().getResourceAsStream(PFX)) {
            ks.load(is, PFX_PASSWORD.toCharArray());
        }
        privateKey = KeyStoreUtils.extractPrivateKey(ks, PFX_PASSWORD);
        certificate = KeyStoreUtils.extractX509Certificate(ks);
    }

    // ── AuthTokenRequestBuilder ───────────────────────────────────────────────────

    @Test
    @DisplayName("AuthTokenRequest XML carries challenge, NIP context and certificateSubject in the auth namespace")
    void buildForNip_producesValidStructure() {
        String xml = AuthTokenRequestBuilder.buildForNip(CHALLENGE, NIP);

        assertThat(xml).contains("AuthTokenRequest");
        assertThat(xml).contains(AuthTokenRequestBuilder.AUTH_NAMESPACE);
        assertThat(xml).contains(CHALLENGE);
        assertThat(xml).contains("<Nip>" + NIP + "</Nip>");
        assertThat(xml).contains(AuthTokenRequestBuilder.SUBJECT_CERTIFICATE_SUBJECT);
    }

    @Test
    @DisplayName("AuthTokenRequest builder rejects a non-10-digit NIP")
    void buildForNip_rejectsBadNip() {
        assertThatThrownBy(() -> AuthTokenRequestBuilder.buildForNip(CHALLENGE, "12345"))
                .isInstanceOf(KsefAuthException.class)
                .hasMessageContaining("NIP");
    }

    // ── XAdESSigner ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("XAdES signature validates against the signing certificate and carries SignedProperties")
    void sign_producesValidEnvelopedXadesSignature() throws Exception {
        String unsigned = AuthTokenRequestBuilder.buildForNip(CHALLENGE, NIP);
        String signed = new XAdESSigner().sign(unsigned, privateKey, certificate);

        // Structural: XAdES qualifying properties present.
        assertThat(signed).contains("QualifyingProperties");
        assertThat(signed).contains("SignedProperties");
        assertThat(signed).contains("http://uri.etsi.org/01903/v1.3.2#");

        // Cryptographic: the enveloped signature actually verifies.
        Document doc = parse(signed);
        // Make the XAdES SignedProperties Id resolvable for reference validation.
        Element signedProps = (Element) doc.getElementsByTagNameNS(
                "http://uri.etsi.org/01903/v1.3.2#", "SignedProperties").item(0);
        if (signedProps != null && signedProps.hasAttribute("Id")) {
            signedProps.setIdAttribute("Id", true);
        }
        Element sigEl = (Element) doc.getElementsByTagNameNS(
                Constants.SignatureSpecNS, "Signature").item(0);
        assertThat(sigEl).isNotNull();

        XMLSignature signature = new XMLSignature(sigEl, "");
        assertThat(signature.checkSignatureValue(certificate.getPublicKey())).isTrue();
    }

    // ── KsefSessionEncryptionService ────────────────────────────────────────────────

    @Test
    @DisplayName("Session encryption round-trips (AES-CBC) and reports correct plaintext hash/size")
    void encryptInvoice_roundTrips() throws Exception {
        KsefSessionEncryptionService svc = new KsefSessionEncryptionService();
        KsefSessionEncryptionService.SessionKey key = svc.generateSessionKey();

        byte[] plaintext = "<Faktura>treść faktury</Faktura>".getBytes(StandardCharsets.UTF_8);
        KsefSessionEncryptionService.EncryptedInvoice enc = svc.encryptInvoice(plaintext, key);

        // AES-CBC decrypt with the same key/IV recovers the plaintext.
        Cipher aes = Cipher.getInstance("AES/CBC/PKCS5Padding");
        aes.init(Cipher.DECRYPT_MODE, key.aesKey(), new IvParameterSpec(key.iv()));
        byte[] decrypted = aes.doFinal(enc.cipherBytes());
        assertThat(decrypted).isEqualTo(plaintext);

        // Hash + size metadata matches the plaintext.
        String expectedHash = Base64.getEncoder().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(plaintext));
        assertThat(enc.invoiceHashB64()).isEqualTo(expectedHash);
        assertThat(enc.invoiceSize()).isEqualTo(plaintext.length);
        assertThat(enc.encryptedInvoiceSize()).isEqualTo(enc.cipherBytes().length);
    }

    @Test
    @DisplayName("Wrapped AES key (RSA-OAEP SHA-256) unwraps to the original session key")
    void buildEncryptionInfo_wrapsKeyRecoverableWithPrivateKey() throws Exception {
        KsefSessionEncryptionService svc = new KsefSessionEncryptionService();
        KsefSessionEncryptionService.SessionKey key = svc.generateSessionKey();

        String certB64 = Base64.getEncoder().encodeToString(certificate.getEncoded());
        EncryptionInfo info = svc.buildEncryptionInfo(key, certB64, "pk-id");

        // Unwrap with the matching private key using the same OAEP parameters.
        Cipher rsa = Cipher.getInstance("RSA/ECB/OAEPPadding");
        rsa.init(Cipher.DECRYPT_MODE, privateKey, new OAEPParameterSpec(
                "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT));
        byte[] unwrapped = rsa.doFinal(Base64.getDecoder().decode(info.encryptedSymmetricKey()));

        assertThat(unwrapped).isEqualTo(key.aesKey().getEncoded());
        assertThat(Base64.getDecoder().decode(info.initializationVector())).isEqualTo(key.iv());
        assertThat(info.publicKeyId()).isEqualTo("pk-id");
    }

    private static Document parse(String xml) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        return dbf.newDocumentBuilder().parse(
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
    }
}
