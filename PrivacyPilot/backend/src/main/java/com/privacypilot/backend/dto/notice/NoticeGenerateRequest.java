package com.privacypilot.backend.dto.notice;

import com.privacypilot.backend.model.enums.notice.NoticeAudience;
import com.privacypilot.backend.model.enums.notice.NoticeLanguage;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * The payload for GENERATING a new privacy-notice version.
 *
 * WHO it is for and the LANGUAGE are validated enum codes ("employees", "pl", …).
 * The `content` is the compiled Markdown text of the notice. The server owns
 * everything else (version, author, timestamp, and the ids of the register
 * activities the notice covers) and re-checks the register before saving, so the
 * client cannot mint a notice the register does not actually support.
 *
 * `title` is optional: the server derives it from the first heading line of the
 * content when it is left blank.
 */
@Data
public class NoticeGenerateRequest {

    @NotNull(message = "audience is required")
    private NoticeAudience audience;

    @NotNull(message = "language is required")
    private NoticeLanguage language;

    // The full notice text (Markdown). Non-blank and size-capped so a bad or abusive
    // payload is rejected rather than stored.
    @NotBlank(message = "content is required")
    @Size(max = 200_000, message = "content is too large")
    private String content;

    // Optional heading. When blank, the server uses the first "# ..." line of content.
    private String title;
}
