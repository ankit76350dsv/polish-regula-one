package com.safevoice.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Request body for submitting a new whistleblower report.
 *
 * The field names here mirror EXACTLY what the public web form sends, so the
 * frontend and backend speak the same language with no translation layer in the
 * browser. The form posts:
 *
 *   {
 *     "tenantId":       "acme-sp-z-o-o" | null,   // which organisation (optional)
 *     "category":       "Corruption",             // a visible category label
 *     "incidentDate":   "2026-06-20",             // calendar date (YYYY-MM-DD)
 *     "area":           "Warehouse, Gdansk",      // where it happened
 *     "facts":          "On 20 June I saw ...",   // the description of what happened
 *     "channel":        "written" | "oral",       // how the reporter wants to report
 *     "requestMeeting": true | false,             // wants an in-person meeting (Art. 9(2))
 *     "attachments":    [{ "displayName": "...", "sizeLabel": "..." }]
 *   }
 *
 * The service layer translates these plain values into the system's strong types
 * (enums, Instant, EvidenceAttachment) — never the browser.
 */
@Data
public class CaseSubmissionRequest {

    // Which organisation the report belongs to. Required: every report must name a
    // real, registered organisation, and the server checks it exists before accepting.
    @NotBlank(message = "Tenant id is required")
    private String tenantId;

    // The visible category label chosen in the form (e.g. "Fraud").
    @NotBlank(message = "Report category is required")
    private String category;

    // The date the incident happened, as a calendar date string "YYYY-MM-DD".
    // Optional so the reporter is never blocked if they cannot recall an exact date.
    private String incidentDate;

    // Free-text location/area where the incident took place. Stored as "department".
    private String area;

    // The actual description of what happened. This is the heart of the report.
    @NotBlank(message = "A description of the facts is required")
    private String facts;

    // How the reporter wants to communicate: "written" (default) or "oral".
    private String channel;

    // True if the reporter is exercising their legal right to request a face-to-face meeting.
    private boolean requestMeeting;

    // Uploaded evidence files. Capped at 5 (matches the frontend and the thread-upload limit)
    // and @Valid so each entry's own size limits are enforced. These bounds are checked at
    // request binding — BEFORE any base64 is decoded — so an oversized/overlong payload is
    // rejected with 400 instead of being buffered and decoded.
    @Size(max = 5, message = "At most 5 attachments are allowed")
    @Valid
    private List<AttachmentMetadata> attachments = new ArrayList<>();

    /**
     * One uploaded evidence file from the report form.
     *
     * The web form sends the anonymised {@code displayName} + {@code sizeLabel} for display,
     * PLUS the actual file so it can be stored: {@code fileName} (used to validate the
     * extension), {@code mimeType}, {@code sizeBytes}, and {@code content} — the file bytes
     * Base64-encoded. When {@code content} is present the backend decodes it and stores the
     * file in S3; when it is absent we keep only the lightweight metadata (backward compatible).
     */
    @Data
    public static class AttachmentMetadata {
        @Size(max = 255, message = "Attachment name is too long")
        private String displayName;

        @Size(max = 64, message = "Attachment size label is too long")
        private String sizeLabel;

        @Size(max = 255, message = "File name is too long")
        private String fileName;

        @Size(max = 128, message = "MIME type is too long")
        private String mimeType;

        private Long sizeBytes;

        // Base64-encoded file bytes (no data: prefix). Capped at ~14 MB of base64, which is a
        // ~10 MB file — the per-file limit. Bounds each entry before it is decoded/stored; the
        // decoded bytes are re-checked against the 10 MB limit in AttachmentService.
        @Size(max = 14_680_064, message = "Attachment is too large")
        private String content;
    }
}
