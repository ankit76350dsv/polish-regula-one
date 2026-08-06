package com.regulaone.backend.dashboard.reader.personal;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Metric;
import com.regulaone.backend.dashboard.dto.MyOverviewResponse.MyDocument;

import java.util.List;

/**
 * What ONE module contributes to one person's "My Workspace" dashboard.
 *
 * It is the personal twin of
 * {@link com.regulaone.backend.dashboard.reader.ModuleSnapshot}: the same
 * metrics + attention pair, plus one extra list.
 *
 *   metrics   — the facts shown on that module's card (counts, hours, dates) for
 *               THIS PERSON only.
 *   attention — the person's own open obligations, already grouped into counts,
 *               for the shared "needs attention" to-do list.
 *   documents — the person's own compliance documents with their expiry dates.
 *               Only SafeWork fills this; every other module returns it empty.
 *
 * WHY documents IS SEPARATE FROM metrics: an employee needs the actual date their
 * medical examination or BHP training runs out, because they may not legally work
 * once it lapses. A count cannot say "book a new examination before 14 August", so
 * the dates travel in their own block that the screen can lay out as a list.
 *
 * Every reader that returns one of these has already limited its query to the one
 * person asking. No snapshot ever carries a colleague's record.
 */
public record PersonalSnapshot(List<Metric> metrics,
                               List<AttentionItem> attention,
                               List<MyDocument> documents) {

    /** The usual case: a module has figures and to-dos but no documents. */
    public static PersonalSnapshot of(List<Metric> metrics, List<AttentionItem> attention) {
        return new PersonalSnapshot(metrics, attention, List.of());
    }

    /** Nothing to report for this person in this module. */
    public static PersonalSnapshot empty() {
        return new PersonalSnapshot(List.of(), List.of(), List.of());
    }
}
