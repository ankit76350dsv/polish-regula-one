package com.safevoice.backend.service;

import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.enums.evidence.AllowedFileExtension;
import com.safevoice.backend.model.enums.evidence.EvidenceStatus;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

import java.net.URI;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Service handling secure, metadata-stripped whistleblower evidence uploads.
 *
 * Files are stored in an AWS S3 bucket (the shared "regulaone" bucket), NOT on the app
 * server's local disk. This gives us durable, encrypted-at-rest storage that keeps working
 * across multiple app instances (the old local-disk vault would not be visible to other
 * pods/servers). Objects are written with server-side encryption and under a UUID key, so
 * the original filename is never used as the storage name (anonymity + no metadata leakage).
 *
 * The bucket must live in the EEA (region defaults to eu-central-1 / Frankfurt) to satisfy
 * the data-residency rules. Credentials are resolved by the AWS default provider chain
 * (environment / IAM role) — never hardcoded, exactly like the KMS client.
 */
@Slf4j
@Service
public class AttachmentService {

    // Which bucket and where. Region is shared with the KMS setting so all AWS access for
    // this app stays in one EEA region. The optional endpoint override lets local dev point
    // at a LocalStack/MinIO S3 without touching real AWS.
    private final String bucket;
    private final String region;
    private final String endpointOverride;

    // All SafeVoice evidence lives under this folder (key prefix) inside the shared bucket, so
    // the whistleblower files are grouped and easy to apply lifecycle/retention rules to.
    private static final String KEY_PREFIX = "safevoice-case-attachment/";

    // Hard per-file size ceiling (10 MB), mirrored on the frontend and the multipart config.
    // Enforced here too so the bytes/base64 path (report submission) is bounded server-side.
    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024;

    private S3Client s3Client;

    // Scans file bytes for malware before anything is written to storage.
    private final MalwareScanService malwareScanService;

    public AttachmentService(
            @Value("${safevoice.vault.s3-bucket:regulaone}") String bucket,
            @Value("${safevoice.encryption.aws.region:eu-central-1}") String region,
            @Value("${safevoice.vault.s3-endpoint:}") String endpointOverride,
            MalwareScanService malwareScanService) {
        this.bucket = bucket;
        this.region = region;
        this.endpointOverride = endpointOverride;
        this.malwareScanService = malwareScanService;
    }

    @PostConstruct
    public void init() {
        S3ClientBuilder builder = S3Client.builder().region(Region.of(region));
        // Local dev against LocalStack/MinIO: path-style access + a custom endpoint.
        if (endpointOverride != null && !endpointOverride.isBlank()) {
            builder = builder.endpointOverride(URI.create(endpointOverride)).forcePathStyle(true);
        }
        this.s3Client = builder.build();
        log.info("[AttachmentService]: evidence storage = S3 bucket '{}' in region '{}'{}",
                bucket, region,
                (endpointOverride != null && !endpointOverride.isBlank())
                        ? " (endpoint " + endpointOverride + ")" : "");
    }

    /**
     * Process an incoming multipart file: validates type, hashes content, strips metadata,
     * saves to S3. Thin wrapper over {@link #store} that just pulls the bytes off the upload.
     */
    public EvidenceAttachment upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload empty file");
        }
        try {
            return store(file.getBytes(), file.getOriginalFilename(), file.getContentType());
        } catch (java.io.IOException e) {
            throw new RuntimeException("File storage failure", e);
        }
    }

    /**
     * Store a file provided as RAW BYTES + its original filename (e.g. decoded from the base64
     * content in the report-submission JSON). Same validation, checksum, metadata-strip and S3
     * write as the multipart {@link #upload} — this is its bytes-based sibling.
     */
    public EvidenceAttachment uploadBytes(byte[] fileBytes, String originalFilename, String contentType) {
        return store(fileBytes, originalFilename, contentType);
    }

    // The shared core: validate, hash, and write one file's bytes to S3, then return its
    // EvidenceAttachment record. Used by both the multipart upload and the base64/bytes path.
    private EvidenceAttachment store(byte[] fileBytes, String originalFilename, String contentType) {
        if (fileBytes == null || fileBytes.length == 0) {
            throw new IllegalArgumentException("Cannot upload empty file");
        }
        if (fileBytes.length > MAX_FILE_BYTES) {
            throw new IllegalArgumentException("File is too large. The maximum size is 10 MB.");
        }
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new IllegalArgumentException("Original filename is missing");
        }

        // Validate extension against the allow-list (PDF, PNG, JPG, XML, DOCX).
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex == -1) {
            throw new IllegalArgumentException("File must have a valid extension");
        }
        String extStr = originalFilename.substring(dotIndex + 1).toUpperCase();
        AllowedFileExtension extension;
        try {
            extension = AllowedFileExtension.valueOf(extStr);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unsupported file extension. Approved: PDF, PNG, JPG, XML, DOCX");
        }

        // Antivirus / malware scan BEFORE the file is ever written to storage. Fails closed:
        // an infected or unscannable file throws (rejected) and is never persisted. This is
        // OUTSIDE the storage try/catch below on purpose, so the malware/unavailable exceptions
        // reach the global handler (422/503) instead of being masked as a generic 500.
        malwareScanService.assertClean(fileBytes, originalFilename);

        try {
            // Calculate SHA-256 Checksum for later integrity validation.
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(fileBytes);
            String checksum = HexFormat.of().formatHex(hash);

            // Generate a UUID storage key to strip metadata and prevent tracing original names.
            String storageRef = KEY_PREFIX + UUID.randomUUID();

            // Write to S3 with server-side encryption (AES-256) so the object is encrypted at rest.
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(storageRef)
                    .contentType(contentType)
                    .serverSideEncryption(ServerSideEncryption.AES256)
                    .build();
            s3Client.putObject(putRequest, RequestBody.fromBytes(fileBytes));

            String sizeLabel = getHumanReadableSize(fileBytes.length);

            // ANONYMITY: we never persist or show the reporter's original filename (it could
            // reveal their identity, e.g. "jan_kowalski_payslip.pdf"). The stored display name is
            // a neutral "Evidence (EXT)" label; the raw name is used ONLY above to validate the
            // extension, then discarded. This matches the report-submission behaviour so both the
            // intake files and the case-thread files are anonymised the same way.
            String anonymisedName = "Evidence (" + extension.name() + ")";

            return new EvidenceAttachment(
                    new org.bson.types.ObjectId().toHexString(),
                    anonymisedName,
                    extension,
                    sizeLabel,
                    EvidenceStatus.SCANNED_CLEAN, // passed the malware scan above
                    true,  // metadataStripped
                    false, // originalNameStored — the original name is intentionally NOT kept
                    Instant.now(),
                    storageRef, // the S3 object key
                    checksum
            );
        } catch (Exception e) {
            throw new RuntimeException("File storage failure", e);
        }
    }

    // The most files we accept attached to ONE message. This keeps a single multipart
    // request a sane size and matches the frontend's cap. Per-file size (10 MB) is enforced
    // by Spring's multipart limits (see application.properties).
    public static final int MAX_FILES_PER_MESSAGE = 5;

    /**
     * Validate and store a batch of files (e.g. the attachments on one chat message).
     * Empty/null entries are skipped; each stored file gets the same metadata-stripping,
     * UUID storage name and SHA-256 checksum as a single upload. Returns an empty list when
     * there are no files, so callers can always use the result directly.
     */
    public List<EvidenceAttachment> uploadAll(List<MultipartFile> files) {
        List<EvidenceAttachment> stored = new ArrayList<>();
        if (files == null || files.isEmpty()) {
            return stored;
        }
        if (files.size() > MAX_FILES_PER_MESSAGE) {
            throw new IllegalArgumentException(
                    "Too many files. You can attach at most " + MAX_FILES_PER_MESSAGE + " files.");
        }
        int index = 0;
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue; // skip empty parts (e.g. an empty "files" field with no real file)
            }
            index++;
            EvidenceAttachment att = upload(file);
            // Number the anonymised label so several files on one message are distinguishable,
            // e.g. "Evidence 1 (PDF)", "Evidence 2 (JPG)" — still no original filename.
            att.setDisplayName("Evidence " + index + " (" + att.getExtension().name() + ")");
            stored.add(att);
        }
        return stored;
    }

    /**
     * Reads file binaries back from the S3 bucket by its stored object key.
     */
    public byte[] getFile(String storageVaultRef) {
        if (storageVaultRef == null || storageVaultRef.isBlank()) {
            throw new IllegalArgumentException("Storage reference is missing");
        }
        try {
            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(storageVaultRef)
                    .build();
            ResponseBytes<GetObjectResponse> objectBytes = s3Client.getObjectAsBytes(getRequest);
            return objectBytes.asByteArray();
        } catch (NoSuchKeyException e) {
            throw new IllegalArgumentException("File not found in storage");
        } catch (Exception e) {
            throw new RuntimeException("Failed to read file from storage", e);
        }
    }

    private String getHumanReadableSize(long size) {
        if (size < 1024) return size + " B";
        int z = (63 - Long.numberOfLeadingZeros(size)) / 10;
        return String.format("%.1f %sB", (double)size / (1L << (z*10)), " KMGTPE".charAt(z));
    }
}
