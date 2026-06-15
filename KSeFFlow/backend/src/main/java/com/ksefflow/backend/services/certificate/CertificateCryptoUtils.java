package com.ksefflow.backend.services.certificate;

import com.ksefflow.backend.config.CertificateStorageProperties;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

// Handles all AES-256-GCM encryption/decryption and certificate password vault logic.
//
// Encrypted byte format:  [12-byte random IV] + [AES-256-GCM ciphertext] + [16-byte GCM auth tag]
// The GCM auth tag is appended automatically by Java — tampered data throws AEADBadTagException.
//
// Vault reference format (dev):  "local:<base64(iv + ciphertext + gcm-tag)>"
// Vault reference format (prod): AWS KMS ARN or HashiCorp Vault path — Phase 2
@Slf4j
@Component
@RequiredArgsConstructor
public class CertificateCryptoUtils {

    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_BITS = 128;
    static final String LOCAL_VAULT_PREFIX = "local:";

    private final CertificateStorageProperties props;

    // Encrypts raw bytes with AES-256-GCM. Each call generates a fresh random IV.
    public byte[] aesEncrypt(byte[] plaintext) { //! [72, 69, 76, 76, 79]
        try {
            byte[] iv = new byte[GCM_IV_LENGTH]; //! [23, -88, 91, 4, 99, ...]
            new SecureRandom().nextBytes(iv); //! 17A85B0463...

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            
            //!
            cipher.init(Cipher.ENCRYPT_MODE, getMasterKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            
            byte[] ciphertext = cipher.doFinal(plaintext); //! [ encrypted data ] + [ authentication tag ] == [AA BB CC DD EE FF ...]

            byte[] result = new byte[GCM_IV_LENGTH + ciphertext.length]; //! Creates a NEW byte array large enough to hold BOTH:
                                                                        // IV ==> Because decryption later needs SAME IV.
                                                                        // ciphertext
            
            //! in the result both the item is retunr [iv + ciphertext]                                                            
            System.arraycopy(iv, 0, result, 0, GCM_IV_LENGTH);
            System.arraycopy(ciphertext, 0, result, GCM_IV_LENGTH, ciphertext.length);
            
            // return array store of the iv and the ciphertext
            return result; // ! return : [ IV ][ ciphertext ][ auth tag ]
        } catch (Exception e) {
            throw new KsefCertificateException(
                    "AES-256-GCM encryption failed: " + e.getMessage(), e);
        }
    }

    //! Decrypts bytes produced by aesEncrypt(). GCM authentication is verified automatically.
    public byte[] aesDecrypt(byte[] encryptedData) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            System.arraycopy(encryptedData, 0, iv, 0, GCM_IV_LENGTH);

            byte[] ciphertext = new byte[encryptedData.length - GCM_IV_LENGTH];
            System.arraycopy(encryptedData, GCM_IV_LENGTH, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
             // getMasterKey(),  coming from the application.properties if this chnagethe dcrption is not possible...
            cipher.init(Cipher.DECRYPT_MODE, getMasterKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return cipher.doFinal(ciphertext);
        } catch (Exception e) {
            throw new KsefCertificateException(
                    "AES-256-GCM decryption failed (wrong key or corrupted data): " + e.getMessage(), e);
        }
    }

    // Encrypts a certificate password and wraps it as a vault reference string.
    // Dev:  "local:<base64(iv + ciphertext + gcm-tag)>"
    // Prod: Phase 2 will call AWS KMS instead and return an ARN-based reference.
    public String encryptPassword(String password) {
        log.info("[encryptPassword]:1 AES-256-GCM encrypting secret into a vault reference");
        byte[] encrypted = aesEncrypt(password.getBytes(StandardCharsets.UTF_8));
        return LOCAL_VAULT_PREFIX + Base64.getEncoder().encodeToString(encrypted);
    }

    // Decrypts a vault reference produced by encryptPassword().
    // Routes by prefix: "local:" = AES decrypt inline; anything else = prod vault (Phase 2).
    public String decryptPassword(String vaultReference) {
        log.info("[decryptPassword]:1 Decrypting vault reference (prefix [{}])",
                vaultReference != null ? vaultReference.substring(0, Math.min(6, vaultReference.length())) : "null");
        if (vaultReference != null && vaultReference.startsWith(LOCAL_VAULT_PREFIX)) {
            String b64 = vaultReference.substring(LOCAL_VAULT_PREFIX.length());
            byte[] encrypted = Base64.getDecoder().decode(b64);
            return new String(aesDecrypt(encrypted), StandardCharsets.UTF_8);
        }
        // Production: route to AWS KMS / HashiCorp Vault based on prefix ("arn:", "vault:", etc.)
        // VaultClient injection is wired in Phase 2.
        throw new KsefCertificateException(
                "Production vault references are not yet implemented. "
                        + "Phase 2 will wire in KMS/Vault routing. Reference prefix: "
                        + (vaultReference != null
                        ? vaultReference.substring(0, Math.min(12, vaultReference.length()))
                        : "null"));
    }

    // Decodes the 64-char hex master key from config into an AES-256 SecretKey.
    // Decoded fresh on every call — intentionally not cached so key rotation takes effect on restart.
    private SecretKey getMasterKey() {
        byte[] keyBytes = hexToBytes(props.getEncryptionKey());
        return new SecretKeySpec(keyBytes, "AES");
    }

    private static byte[] hexToBytes(String hex) {
        // hex : "1234abcd" ==>  [18, 52, 171, 205] 
        int len = hex.length();
        byte[] data = new byte[len / 2]; //! 2 hex chars = 1 byte
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        
        return data; // [18, 52, 171, 205] <=== 12, 34, ab, cd
    }
}
