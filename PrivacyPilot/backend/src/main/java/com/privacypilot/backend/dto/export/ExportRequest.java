package com.privacypilot.backend.dto.export;

import com.privacypilot.backend.model.enums.export.ExportFormat;
import com.privacypilot.backend.model.enums.export.ExportTarget;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * "I am about to take a copy of this out of the app" — the payload the browser sends
 * BEFORE it produces a file, print view or clipboard copy.
 *
 * The server turns this into one immutable EXPORT line in the audit trail. Everything
 * that identifies WHO did it (user, role, company, IP, browser) is taken from the verified
 * session, never from this payload — so the only things the client may say are WHAT was
 * copied, HOW, and HOW MUCH.
 */
@Data
public class ExportRequest {

    /** What was copied — the register, the audit trail, a notice, a breach report. */
    @NotNull(message = "target is required")
    private ExportTarget target;

    /** How it was copied — file download, print window, or clipboard. */
    @NotNull(message = "format is required")
    private ExportFormat format;

    /**
     * The id of the single record being exported. REQUIRED for single-document targets
     * (privacy notice, breach report) and checked against the caller's own company;
     * ignored for whole-list targets, which have no single id.
     */
    @Size(max = 64, message = "entityId is too long")
    private String entityId;

    /**
     * How many records the copy contained — for whole-list exports, so the audit line
     * shows the size of what left. Capped well above any realistic register so a silly
     * value cannot be stored.
     */
    @Min(value = 0, message = "itemCount cannot be negative")
    @Max(value = 1_000_000, message = "itemCount is unrealistically large")
    private Integer itemCount;

    /**
     * A short, human-readable note of the filters that were on screen, e.g.
     * "department=hr; basis=consent". Kept for forensics: it says WHICH slice of the
     * register left, without storing a long list of ids on the audit line.
     */
    @Size(max = 500, message = "filterSummary is too long")
    private String filterSummary;
}
