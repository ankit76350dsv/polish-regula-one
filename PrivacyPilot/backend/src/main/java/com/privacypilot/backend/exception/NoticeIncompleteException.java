package com.privacypilot.backend.exception;

import lombok.Getter;

import java.util.List;

/**
 * Thrown when a privacy notice cannot be generated because the register does not
 * yet contain everything Art. 13/14 requires for that audience (for example an
 * activity is missing its purpose, lawful basis or retention period).
 *
 * It is mapped to a 422 response with the machine code CHECKLIST_INCOMPLETE by the
 * {@link GlobalExceptionHandler}, so the frontend can show the user exactly what to
 * fix in the register before trying again.
 */
@Getter
public class NoticeIncompleteException extends RuntimeException {

    // The GDPR references of the requirements that are still not satisfied.
    private final transient List<String> missing;

    public NoticeIncompleteException(List<String> missing) {
        super("The register is not complete enough to generate this notice: "
                + String.join(", ", missing));
        this.missing = missing;
    }
}
