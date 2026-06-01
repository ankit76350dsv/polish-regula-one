package com.ksefflow.backend.controllers;

import com.ksefflow.backend.dto.certificate.CertificateResponse;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.services.certificate.CertificateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST API for managing KSeF digital signing certificates.
 *
 * Accepts .pfx (PKCS#12) and .pem files uploaded by a tenant admin.
 * All file bytes are AES-256-GCM encrypted before being written to disk/S3.
 * No private key material or raw certificate bytes are ever returned —
 * responses contain only safe metadata via CertificateResponse.
 *
 * Tenant identity is resolved from the X-Tenant-Id request header.
 * User identity is resolved from the X-User-Id request header.
 *
 * Endpoints:
 *   POST   /api/v1/certificates/upload          — upload a PFX or PEM file
 *   GET    /api/v1/certificates                 — list all certificates for tenant
 *   PATCH  /api/v1/certificates/{id}/deactivate — deactivate a certificate
 *
 * Accepted file types:
 *   .pfx / .p12   — PKCS#12 bundle (certificate + private key). Required for signing.
 *   .pem / .crt   — PEM-encoded X.509 certificate (public cert only, no private key).
 */
@RestController
@RequestMapping("/api/v1/certificates")
@RequiredArgsConstructor
@Slf4j
public class KSeFCertificateController {

    private static final long MAX_FILE_SIZE_BYTES = 1_048_576L; // 1 MB hard limit (controller-level guard)

    private final CertificateService certificateService;

    // ── POST /api/v1/certificates/upload ─────────────────────────────────────
    /**
     * Uploads and securely stores a signing certificate for a tenant.
     *
     * Accepted formats:
     *   .pfx / .p12   — PKCS#12 bundle. Requires the certificate password.
     *                    Validates the keystore, extracts X.509 metadata, AES-256-GCM
     *                    encrypts the file, and stores the password in the vault.
     *   .pem / .crt   — PEM-encoded X.509 certificate (public certificate only).
     *                    No password required. Stores the cert for reference but
     *                    NOTE: PEM-only certs cannot be used for KSeF signing
     *                    (signing requires a PFX with a private key).
     *
     * On success, any previously active certificate is deactivated — only one
     * active certificate is allowed per tenant at any time.
     *
     * Request (multipart/form-data):
     *   file      — the certificate file (.pfx / .p12 / .pem / .crt)
     *   password  — certificate password (required for PFX, omit for PEM)
     *
     * Headers:
     *   X-Tenant-Id  — tenant that owns this certificate (required)
     *   X-User-Id    — user performing the upload (optional, stored for audit)
     *
     * Response 200: CertificateResponse with metadata of the stored certificate
     * Response 400: invalid file format, wrong password, or file too large
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CertificateResponse> uploadCertificate(
            @RequestHeader("X-Tenant-Id")                          String tenantId,
            @RequestHeader(value = "X-User-Id", required = false)  String userId,
            @RequestPart("file")                                    MultipartFile file,
            @RequestParam(value = "password", required = false)     String password) throws IOException {

        log.info("[CertificateController] POST /upload — tenant={} fileName={} size={}",
                tenantId, file.getOriginalFilename(), file.getSize());

        validateFile(file);

        String fileName   = sanitizeFileName(file.getOriginalFilename());
        String extension  = getExtension(fileName);
        byte[] fileBytes  = file.getBytes();

        KsefCertificate stored;

        if (isPfx(extension)) {
            if (password == null || password.isBlank()) {
                return ResponseEntity.badRequest().build();
            }
            stored = certificateService.storeCertificate(fileBytes, tenantId, fileName, password, userId);
            log.info("[CertificateController] PFX certificate stored — tenant={} certId={}", tenantId, stored.getId());
        } else if (isPem(extension)) {
            stored = certificateService.storePemCertificate(fileBytes, tenantId, fileName, userId);
            log.info("[CertificateController] PEM certificate stored — tenant={} certId={}", tenantId, stored.getId());
        } else {
            log.warn("[CertificateController] Rejected unsupported file type: {}", fileName);
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(CertificateResponse.from(stored));
    }

    // ── GET /api/v1/certificates ──────────────────────────────────────────────
    /**
     * Lists all certificates for the tenant, newest first.
     *
     * Returns both active and inactive certificates so admins can see the full
     * upload history. Only metadata is returned — no file bytes or passwords.
     *
     * Headers:
     *   X-Tenant-Id — required
     *
     * Response 200: array of CertificateResponse (may be empty)
     */
    @GetMapping
    public ResponseEntity<List<CertificateResponse>> listCertificates(
            @RequestHeader("X-Tenant-Id") String tenantId) {

        log.info("[CertificateController] GET /certificates — tenant={}", tenantId);

        List<CertificateResponse> certs = certificateService.listCertificates(tenantId)
                .stream()
                .map(CertificateResponse::from)
                .collect(Collectors.toList());

        return ResponseEntity.ok(certs);
    }

    // ── PATCH /api/v1/certificates/{id}/deactivate ────────────────────────────
    /**
     * Deactivates a specific certificate so it is no longer used for signing.
     *
     * This is a soft disable — the encrypted file remains in storage and the
     * MongoDB record is preserved for audit purposes. The certificate can be
     * re-activated only by uploading a replacement (which auto-activates).
     *
     * Path variable:
     *   {id} — MongoDB document ID of the certificate to deactivate
     *
     * Headers:
     *   X-Tenant-Id — required (prevents cross-tenant deactivation)
     *
     * Response 200: { "message": "Certificate deactivated" }
     * Response 404: certificate not found or belongs to a different tenant
     */
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Map<String, String>> deactivateCertificate(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable                 String id) {

        log.info("[CertificateController] PATCH /{}/deactivate — tenant={}", id, tenantId);

        certificateService.deactivateCertificate(tenantId, id);
        return ResponseEntity.ok(Map.of("message", "Certificate deactivated successfully"));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Certificate file must not be empty");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException(
                    "Certificate file exceeds the 1 MB size limit (" + file.getSize() + " bytes)");
        }
        String name = file.getOriginalFilename();
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Certificate file must have a filename");
        }
        String ext = getExtension(name);
        if (!isPfx(ext) && !isPem(ext)) {
            throw new IllegalArgumentException(
                    "Unsupported file type '" + ext + "'. Accepted: .pfx, .p12, .pem, .crt");
        }
    }

    private static String sanitizeFileName(String rawName) {
        if (rawName == null) return "certificate";
        // Strip any path traversal components — keep only the final filename
        return Paths.get(rawName).getFileName().toString()
                .replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private static String getExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot >= 0 ? fileName.substring(dot + 1).toLowerCase() : "";
    }

    private static boolean isPfx(String ext) {
        return "pfx".equals(ext) || "p12".equals(ext);
    }

    private static boolean isPem(String ext) {
        return "pem".equals(ext) || "crt".equals(ext);
    }
}
