package com.safevoice.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response returned to the reporter right after a successful submission.
 *
 * It contains the ONE credential the reporter ever receives: a single 64-character
 * access key. That key is both the case's identifier AND its password. We show it to
 * the reporter once here and then forget it forever (we keep only its hash). If the
 * reporter loses it, the case can never be reopened by them — that is the price of
 * true anonymity, and the UI warns them to save it.
 *
 * For HR grievance cases there is NO access key (the case is handed to HR instead),
 * so {@code accessKey} is null and {@code isHrOnly} is true.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseSubmissionResponse {

    // The 64-char hex access key, shown to the reporter once. Null for HR grievances.
    private String accessKey;

    // True when the report was an individual HR grievance (routed to HR, no key issued).
    // @JsonProperty keeps the JSON name as "isHrOnly" so it matches the field the web app reads.
    @JsonProperty("isHrOnly")
    private boolean hrOnly;
}
