package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.dto.ksefapi.EncryptionInfo;
import com.ksefflow.backend.exceptions.KsefSubmissionException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.MGF1ParameterSpec;
import java.io.ByteArrayInputStream;
import java.util.Base64;

/**
 * Implements the KSeF 2.0 online-session end-to-end encryption scheme.
 *
 * <p>Each online session uses a fresh AES-256 key + 16-byte IV. The AES key is wrapped
 * with the Ministry of Finance RSA public key using <b>RSA-OAEP (SHA-256, MGF1-SHA256)</b>
 * and sent in {@link EncryptionInfo}. Every invoice in the session is encrypted with
 * <b>AES-256-CBC / PKCS#5</b> using that key + IV, and sent together with SHA-256 hashes
 * and byte sizes of both the plaintext and the ciphertext so KSeF can verify integrity.
 */
@Slf4j
@Component
public class KsefSessionEncryptionService {

    private static final int AES_KEY_BITS = 256;
    private static final int IV_BYTES = 16;

    /** A per-session symmetric key and IV. */
    public record SessionKey(SecretKey aesKey, byte[] iv) {
    }

    /** Encrypted invoice payload plus the integrity metadata KSeF requires. */
    public record EncryptedInvoice(
            byte[] cipherBytes,
            String invoiceHashB64,
            long invoiceSize,
            String encryptedInvoiceHashB64,
            long encryptedInvoiceSize) {
    }

    /** Generates a fresh AES-256 key and random 16-byte IV for a new online session. */
    public SessionKey generateSessionKey() {
        log.info("[generateSessionKey]:1 Generating AES-256 session key + 16-byte IV");
        try {
            KeyGenerator kg = KeyGenerator.getInstance("AES");
            kg.init(AES_KEY_BITS, new SecureRandom());
            SecretKey key = kg.generateKey();
            byte[] iv = new byte[IV_BYTES];
            new SecureRandom().nextBytes(iv);
            return new SessionKey(key, iv);
        } catch (Exception e) {
            throw new KsefSubmissionException("Failed to generate KSeF session key: " + e.getMessage(), e);
        }
    }

    /**
     * Builds the {@link EncryptionInfo} for {@code POST /sessions/online} by RSA-OAEP
     * wrapping the AES key with the KSeF public key certificate (Base64 DER).
     *
     * @param key                 the session key/IV
     * @param ksefPublicCertB64   Base64(DER) X.509 cert from /security/public-key-certificates
     * @param publicKeyId         the publicKeyId of that certificate (echoed back to KSeF)
     */
    public EncryptionInfo buildEncryptionInfo(SessionKey key, String ksefPublicCertB64, String publicKeyId) {
        log.info("[buildEncryptionInfo]:1 RSA-OAEP wrapping session key with KSeF public key [{}]", publicKeyId);
        try {
            X509Certificate ksefCert = parseCertificate(ksefPublicCertB64);
            PublicKey rsaPublicKey = ksefCert.getPublicKey();

            Cipher rsa = Cipher.getInstance("RSA/ECB/OAEPPadding");
            OAEPParameterSpec oaep = new OAEPParameterSpec(
                    "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT);
            rsa.init(Cipher.ENCRYPT_MODE, rsaPublicKey, oaep);
            byte[] wrappedKey = rsa.doFinal(key.aesKey().getEncoded());

            return new EncryptionInfo(
                    Base64.getEncoder().encodeToString(wrappedKey),
                    Base64.getEncoder().encodeToString(key.iv()),
                    publicKeyId);
        } catch (Exception e) {
            throw new KsefSubmissionException("Failed to wrap AES session key with KSeF public key: "
                    + e.getMessage(), e);
        }
    }

    /** Encrypts one invoice's plaintext bytes with the session key (AES-256-CBC/PKCS5). */
    public EncryptedInvoice encryptInvoice(byte[] plaintext, SessionKey key) {
        log.info("[encryptInvoice]:1 AES-256-CBC encrypting invoice ({} plaintext bytes)", plaintext.length);
        try {
            Cipher aes = Cipher.getInstance("AES/CBC/PKCS5Padding");
            aes.init(Cipher.ENCRYPT_MODE, key.aesKey(), new IvParameterSpec(key.iv()));
            byte[] cipherBytes = aes.doFinal(plaintext);

            return new EncryptedInvoice(
                    cipherBytes,
                    sha256Base64(plaintext),
                    plaintext.length,
                    sha256Base64(cipherBytes),
                    cipherBytes.length);
        } catch (Exception e) {
            throw new KsefSubmissionException("Failed to AES-encrypt invoice for KSeF session: "
                    + e.getMessage(), e);
        }
    }

    private static String sha256Base64(byte[] data) throws Exception {
        return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(data));
    }

    private static X509Certificate parseCertificate(String base64Der) throws Exception {
        byte[] der = Base64.getDecoder().decode(base64Der);
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        return (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(der));
    }
}
