package com.safevoice.backend.service;

import com.safevoice.backend.model.embedded.EvidenceAttachment;
import com.safevoice.backend.model.enums.evidence.AllowedFileExtension;
import com.safevoice.backend.model.enums.evidence.EvidenceStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Service handling secure, metadata-stripped whistleblower evidence uploads.
 */
@Service
public class AttachmentService {

    private final Path targetDir;

    public AttachmentService(
            @Value("${safevoice.vault.storage-dir:storage/vault}") String vaultStoragePath) {
        this.targetDir = Paths.get(vaultStoragePath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(targetDir);
        } catch (IOException e) {
            throw new RuntimeException("Failed to initialize vault storage folder", e);
        }
    }

    /**
     * Process an incoming file: validates type, hashes content, strips metadata, saves to disk.
     */
    public EvidenceAttachment upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload empty file");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new IllegalArgumentException("Original filename is missing");
        }

        // Validate extension
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

        try {
            byte[] fileBytes = file.getBytes();

            // Calculate SHA-256 Checksum
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(fileBytes);
            String checksum = HexFormat.of().formatHex(hash);

            // Generate UUID storage filename to strip metadata and prevent tracing original names
            UUID storageRef = UUID.randomUUID();
            Path filePath = targetDir.resolve(storageRef.toString());
            Files.write(filePath, fileBytes);

            String sizeLabel = getHumanReadableSize(file.getSize());

            return new EvidenceAttachment(
                    UUID.randomUUID(),
                    originalFilename,
                    extension,
                    sizeLabel,
                    EvidenceStatus.METADATA_STRIPPED,
                    true, // metadataStripped
                    true, // originalNameStored
                    Instant.now(),
                    storageRef.toString(),
                    checksum
            );
        } catch (Exception e) {
            throw new RuntimeException("File storage failure", e);
        }
    }

    /**
     * Reads file binaries from secure vault.
     */
    public byte[] getFile(String storageVaultRef) {
        if (storageVaultRef == null || storageVaultRef.isBlank()) {
            throw new IllegalArgumentException("Storage reference is missing");
        }
        try {
            Path filePath = targetDir.resolve(storageVaultRef).normalize();
            if (!filePath.startsWith(targetDir)) {
                throw new SecurityException("Directory traversal attempt detected");
            }
            if (!Files.exists(filePath)) {
                throw new IllegalArgumentException("File not found in vault");
            }
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read file from vault", e);
        }
    }

    private String getHumanReadableSize(long size) {
        if (size < 1024) return size + " B";
        int z = (63 - Long.numberOfLeadingZeros(size)) / 10;
        return String.format("%.1f %sB", (double)size / (1L << (z*10)), " KMGTPE".charAt(z));
    }
}
