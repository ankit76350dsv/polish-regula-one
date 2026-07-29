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
 * the version number and keeps the old one for history, so the company can
 * prove
 * what people were told and when.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "privacypilot_notices")
public class PrivacyNotice extends BaseDocument {

    // WHAT: WHO this notice is for (the audience).
    // WHY: Different people must get different notices — the law treats data
    //      collected FROM the person (Art. 13) differently from data collected
    //      about them from elsewhere (Art. 14).
    // EXAMPLE: EMPLOYEES, WEBSITE_USERS, CANDIDATES, WHISTLEBLOWERS.
    private NoticeAudience audience;

    // WHAT: The ids of the register activities this notice was built from.
    // WHY: The notice text is COMPILED from those activities, so it always matches
    //      what the company really does. This links back to privacypilot_activities.
    // EXAMPLE: ["act-hr-payroll", "act-recruitment"] for an employee notice.
    private List<String> activityIds = new ArrayList<>();

    // WHAT: The language this version was written in.
    // WHY: People must be told in a language they understand; Polish is the default
    //      for the Polish market, English is offered too.
    // EXAMPLE: PL or EN.
    private NoticeLanguage language;

    // WHAT: The heading shown at the top of the notice.
    // WHY: So the reader (and the company) can tell what the document is.
    // EXAMPLE: "Klauzula informacyjna dla pracowników" (Employee privacy notice).
    private String title;

    // WHAT: The full generated notice text, stored as Markdown.
    // WHY: This is the actual document people read / the company downloads or prints.
    //      Regenerating makes a NEW version rather than overwriting this one.
    // EXAMPLE: "## Kto jest administratorem? ... ## Jak długo przechowujemy dane? ...".
    private String content;

    // WHAT: The version number for this audience. Starts at 1, +1 each regeneration.
    // WHY: Notices change over time; keeping versions PROVES what people were told
    //      and when — important evidence during an audit.
    // EXAMPLE: 1 for the first notice; 2 after the register changes and it's redone.
    private int version;

    // WHAT: When this version was generated.
    // WHY: Records the moment the text was produced, for the version history.
    // EXAMPLE: 2026-07-17T10:15:00Z.
    private Instant generatedAt;

    // WHAT: The name of the person who generated this version.
    // WHY: Accountability — the audit trail shows WHO produced the notice.
    // EXAMPLE: "Karolina Wójcik".
    private String generatedBy;
}
