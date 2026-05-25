package com.ksefflow.backend.services.certificateutils;

import com.ksefflow.backend.config.CertificateStorageProperties;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

// Handles encrypted .pfx file read/write on the local filesystem (dev)
// or S3 key prefix (prod — extend writePfxEncrypted for S3 in Phase 2).
//
// File stored as: {storagePath}/{tenantId}/{fileName}.enc
// The file contains: [12-byte IV] + [AES-256-GCM ciphertext + 16-byte auth tag]
// — raw .pfx bytes are NEVER written to disk in plaintext.
@Component
@RequiredArgsConstructor
@Slf4j
public class CertificateStorageUtils {

    private final CertificateStorageProperties props;
    private final CertificateCryptoUtils crypto;

    // Encrypts the .pfx bytes and writes them to tenant-scoped storage.
    // Creates the tenant directory if it does not exist.
    // Returns the full file path — stored in KsefCertificate.encryptedStoragePath in MongoDB.
    public String writePfxEncrypted(String tenantId, byte[] pfxBytes, String fileName) {
        try {
            byte[] encrypted = crypto.aesEncrypt(pfxBytes);
            Path dir = Paths.get(props.getStoragePath(), tenantId);
            Files.createDirectories(dir);
            Path target = dir.resolve(fileName + ".enc");
            Files.write(target, encrypted);
            log.debug("Wrote encrypted certificate to {}", target);
            return target.toString();
        } catch (IOException e) {
            throw new KsefCertificateException(
                    "Failed to write certificate to storage: " + e.getMessage(), e);
        }
    }

    // Reads the encrypted file from disk and decrypts it back to the original .pfx bytes.
    // Called when the service needs to load the KeyStore at runtime (e.g. for signing).
    public byte[] readPfxDecrypted(String storagePath) {
        try {
            byte[] encrypted = Files.readAllBytes(Paths.get(storagePath));
            return crypto.aesDecrypt(encrypted);
        } catch (IOException e) {
            throw new KsefCertificateException(
                    "Failed to read certificate from storage path: " + storagePath, e);
        }
    }
}
