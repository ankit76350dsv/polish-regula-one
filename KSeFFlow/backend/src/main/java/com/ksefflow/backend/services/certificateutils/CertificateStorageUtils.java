package com.ksefflow.backend.services.certificateutils;

import com.ksefflow.backend.config.CertificateStorageProperties;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

// Handles encrypted .pfx/.pem file read/write on AWS S3 — in ALL environments
// (local dev and production). There is no filesystem fallback.
//
// S3 layout: s3://{bucket}/{keyPrefix}/{tenantId}/{fileName}.enc
//
// The object always contains: [12-byte IV] + [AES-256-GCM ciphertext + 16-byte auth tag]
// — raw .pfx bytes are NEVER stored in plaintext.
//
// The value returned by writePfxEncrypted() is persisted as
// KsefCertificate.encryptedStoragePath (an "s3://bucket/key" URI) so
// readPfxDecrypted() can resolve the bucket + key back when loading the keystore.
@Component
@Slf4j
@RequiredArgsConstructor
public class CertificateStorageUtils {

    private static final String S3_SCHEME = "s3://";

    private final CertificateStorageProperties props;
    private final CertificateCryptoUtils crypto;
    private final S3Client s3Client;

    // Encrypts the .pfx bytes and uploads them to tenant-scoped S3 storage.
    // Returns the "s3://bucket/key" locator — stored in KsefCertificate.encryptedStoragePath.
    public String writePfxEncrypted(String tenantId, byte[] pfxBytes, String fileName) {
        byte[] encrypted = crypto.aesEncrypt(pfxBytes);  //! Encrypted : [ IV ][ ciphertext ][ auth tag ]

        CertificateStorageProperties.S3 cfg = props.getS3();
        String key = buildS3Key(tenantId, fileName);
        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(cfg.getBucket())
                            .key(key)
                            // Defence in depth — bucket-level SSE should also be enforced,
                            // but request server-side encryption (AES-256) explicitly too.
                            .serverSideEncryption(ServerSideEncryption.AES256)
                            .contentType("application/octet-stream")
                            .build(),
                    RequestBody.fromBytes(encrypted));

            String locator = S3_SCHEME + cfg.getBucket() + "/" + key;
            log.debug("Wrote encrypted certificate to {}", locator);
            return locator;
        } catch (S3Exception e) {
            throw new KsefCertificateException(
                    "Failed to write certificate to S3: " + e.awsErrorDetails().errorMessage(), e);
        }
    }

    // Downloads the encrypted object from S3 and decrypts it back to the original .pfx bytes.
    // Called when the service needs to load the KeyStore at runtime (e.g. for signing).
    public byte[] readPfxDecrypted(String storagePath) {
        byte[] encrypted = readFromS3(storagePath);
        return crypto.aesDecrypt(encrypted);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────────

    private byte[] readFromS3(String locator) {
        if (locator == null || !locator.startsWith(S3_SCHEME)) {
            throw new KsefCertificateException("Invalid S3 storage locator: " + locator);
        }
        // locator = s3://{bucket}/{key}
        String withoutScheme = locator.substring(S3_SCHEME.length());
        int slash = withoutScheme.indexOf('/');
        if (slash < 0) {
            throw new KsefCertificateException("Malformed S3 storage locator: " + locator);
        }
        String bucket = withoutScheme.substring(0, slash);
        String key = withoutScheme.substring(slash + 1);
        try {
            ResponseBytes<GetObjectResponse> object = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(bucket).key(key).build());
            return object.asByteArray();
        } catch (S3Exception e) {
            throw new KsefCertificateException(
                    "Failed to read certificate from S3 locator " + locator + ": "
                            + e.awsErrorDetails().errorMessage(), e);
        }
    }

    private String buildS3Key(String tenantId, String fileName) {
        String prefix = props.getS3().getKeyPrefix();
        StringBuilder key = new StringBuilder();
        if (prefix != null && !prefix.isBlank()) {
            key.append(prefix.replaceAll("^/+|/+$", "")).append('/');
        }
        key.append(tenantId).append('/').append(fileName).append(".enc");
        return key.toString();
    }
}
