package com.ksefflow.backend.controllers;

import com.ksefflow.backend.dto.certificate.CertificateResponse;
import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.utils.KsefCertificatePurpose;
import com.ksefflow.backend.security.AuthenticatedUser;
import com.ksefflow.backend.security.KsefPermission;
import com.ksefflow.backend.services.certificate.CertificateService;
import com.ksefflow.backend.services.certificate.KsefCertificateEnrollmentService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
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
 * Tenant and user identity are resolved from the authenticated session (the
 * idToken cookie, verified via the RegulaOne backend) — never from a client header.
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
    private final KsefCertificateEnrollmentService enrollmentService;

    // ── POST /api/v1/certificates/enroll ─────────────────────────────────────
    /**
     * Requests a brand-new KSeF-issued certificate (gap C3) instead of uploading one.
     *
     * KSeFFlow generates the key pair locally, asks KSeF to issue a certificate for it, waits
     * for it, downloads it, and stores it encrypted — all server-side. The private key never
     * leaves the server in the clear.
     *
     * @param nip     the tenant's own 10-digit NIP (authentication context)
     * @param purpose AUTHENTICATION (default — log in to KSeF) or OFFLINE (seal offline invoices)
     * @param name    a friendly name for the certificate
     *
     * Response 201: CertificateResponse (safe metadata only)
     * Response 400: enrollment failed / rejected by KSeF
     */
    // Permissions: KSEF_TENANT_ADMIN only — issuing a KSeF certificate is an
    //              administrative, legally significant action. No other role may enroll.
    @PostMapping("/enroll")
    public ResponseEntity<CertificateResponse> enroll(
            AuthenticatedUser caller,
            @RequestParam @NotBlank @Pattern(regexp = "\\d{10}", message = "NIP must be exactly 10 digits") String nip,
            @RequestParam(defaultValue = "AUTHENTICATION") KsefCertificatePurpose purpose,
            @RequestParam @NotBlank String name) {

        // Issuing a KSeF certificate is an admin-only action.
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN);

        log.info("[enroll]:1 POST /certificates/enroll — tenant={} purpose={} name={}",
                caller.tenantId(), purpose, name);
        KsefCertificate cert = enrollmentService.enrollAndStore(
                caller.tenantId(), nip, name, purpose, caller.userId());
        log.info("[enroll]:2 Certificate enrolled — id={} serial={}", cert.getId(), cert.getCertificateSerialNumber());
        return ResponseEntity.status(HttpStatus.CREATED).body(CertificateResponse.from(cert));
    }

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
     * Tenant (owner) and user (for audit) are taken from the authenticated session.
     *
     * Response 200: CertificateResponse with metadata of the stored certificate
     * Response 400: invalid file format, wrong password, or file too large
     */
    // Permissions: KSEF_TENANT_ADMIN only — uploading/replacing the signing certificate
    //              controls how the whole tenant signs invoices, so it stays admin-only.
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CertificateResponse> uploadCertificate(
            AuthenticatedUser                                       caller,
            @RequestPart("file")                                    MultipartFile file,
            @RequestParam(value = "password", required = false)     String password) throws IOException {

        // Uploading/replacing the signing certificate is an admin-only action.
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN);

        String tenantId = caller.tenantId();
        String userId = caller.userId();

        log.info("[uploadCertificate]:1 POST /upload — tenant={} fileName={} size={}",
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
            log.info("[uploadCertificate]:2 PFX certificate stored — tenant={} certId={}", tenantId, stored.getId());
        } else if (isPem(extension)) {
            stored = certificateService.storePemCertificate(fileBytes, tenantId, fileName, userId);
            log.info("[uploadCertificate]:3 PEM certificate stored — tenant={} certId={}", tenantId, stored.getId());
        } else {
            log.warn("[uploadCertificate]:4 Rejected unsupported file type: {}", fileName);
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
     * Tenant is taken from the authenticated session.
     *
     * Response 200: array of CertificateResponse (may be empty)
     */
    // Permissions: KSEF_TENANT_ADMIN (manage), KSEF_AUDITOR (read-only, for audit review).
    //              Metadata only — no private keys or passwords are ever returned.
    @GetMapping
    public ResponseEntity<List<CertificateResponse>> listCertificates(
            AuthenticatedUser caller) {

        // Read access — auditors (for review) or the tenant admin.
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN, KsefPermission.KSEF_AUDITOR);

        String tenantId = caller.tenantId();
        log.info("[listCertificates]:1 GET /certificates — tenant={}", tenantId);

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
     * Tenant is taken from the authenticated session (prevents cross-tenant deactivation).
     *
     * Response 200: { "message": "Certificate deactivated" }
     * Response 404: certificate not found or belongs to a different tenant
     */
    // Permissions: KSEF_TENANT_ADMIN only — disabling a certificate changes the tenant's
    //              signing setup, so it is restricted to admins.
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Map<String, String>> deactivateCertificate(
            AuthenticatedUser caller,
            @PathVariable     String id) {

        // Disabling a certificate changes the tenant's signing setup — admin-only.
        caller.requireAnyPermission(KsefPermission.KSEF_TENANT_ADMIN);

        String tenantId = caller.tenantId();
        log.info("[deactivateCertificate]:1 PATCH /{}/deactivate — tenant={}", id, tenantId);

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
