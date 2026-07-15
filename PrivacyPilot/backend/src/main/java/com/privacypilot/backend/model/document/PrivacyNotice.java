package com.privacypilot.backend.model.document;

import com.privacypilot.backend.model.base.BaseDocument;
import com.privacypilot.backend.model.enums.notice.NoticeAudience;
import com.privacypilot.backend.model.enums.notice.NoticeLanguage;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A privacy notice (in Polish: klauzula informacyjna) — the text a company must
 * give people to explain how their data is used (Art. 13/14 GDPR). PrivacyPilot
 * builds this text from the register, so it always matches the real activities.
 *
 * Notices are versioned: generating a new one for the same audience increases
 * the version number and keeps the old one for history, so the company can prove
 * what people were told and when.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_notices")
public class PrivacyNotice extends BaseDocument {

    // Who the notice is for (employees, website users, whistleblowers, ...).
    private NoticeAudience audience;

    // The language the notice was generated in.
    private NoticeLanguage language;

    // Version number for this audience. Starts at 1 and grows each regeneration.
    private int version;

    // The heading of the notice.
    private String title;

    // The ids of the activities this notice was built from.
    private List<String> activityIds = new ArrayList<>();

    // The full generated notice text (Markdown). May be regenerated on demand.
    private String content;

    // When this version was generated.
    private Instant generatedAt;

    // The name of the person who generated it.
    private String generatedBy;
}
