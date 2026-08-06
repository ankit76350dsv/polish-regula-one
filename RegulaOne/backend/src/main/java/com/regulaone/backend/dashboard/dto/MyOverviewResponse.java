package com.regulaone.backend.dashboard.dto;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.ActivityEntry;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.ModuleCard;

import java.time.Instant;
import java.util.List;

/**
 * Everything the RegulaOne "My Workspace" dashboard shows, in ONE response.
 *
 * SIMPLE EXPLANATION (what this is for):
 *   A normal member of a company (role ROLE_USER) signs in and wants one page
 *   that answers "what do I have to do, and am I allowed to work today?" across
 *   the six compliance apps (KSeFFlow, WorkPulse, SafeWork, SafeVoice, WasteSync,
 *   PrivacyPilot). This one response carries those answers so the browser makes a
 *   single call.
 *
 * ── HOW THIS DIFFERS FROM THE COMPANY-ADMIN DASHBOARD ──────────────────────────
 *
 * {@link CompanyOverviewResponse} answers "is my COMPANY compliant?" and returns
 * whole-company counts. This response answers "am *I* in order?" and returns ONLY
 * records that belong to the person asking:
 *
 *   * WorkPulse    — only their own shifts, breaks, overtime and absences.
 *   * SafeWork     — only their own medical certificate and BHP training.
 *   * KSeFFlow     — only the invoices they created themselves.
 *   * WasteSync    — only the waste records they entered themselves.
 *   * PrivacyPilot — only the records they created themselves.
 *   * SafeVoice    — only the reports assigned to them, and only when they hold a
 *                    SafeVoice case-handler permission.
 *
 * A normal employee therefore NEVER sees another colleague's figures and never
 * sees a company total. That is deliberate: whole-company oversight is a manager's
 * job and lives on {@code GET /api/admin/overview}, while a plain employee has no
 * lawful need for their colleagues' numbers (GDPR Art. 5(1)(c) data minimisation,
 * and least privilege).
 *
 * ── WHY IT IS SHAPED LIKE THIS ──────────────────────────────────────────────────
 *
 *   1. SAME BUILDING BLOCKS AS THE ADMIN DASHBOARD. The {@code Metric},
 *      {@code ModuleCard}, {@code AttentionItem} and {@code ActivityEntry} types
 *      are reused from {@link CompanyOverviewResponse}, so the browser formats,
 *      colours and translates both screens with exactly the same code.
 *
 *   2. EVERY NUMBER IS A REAL FACT. Nothing is invented and there is no made-up
 *      "score". The screen shows what is actually recorded and what is actually
 *      due.
 *
 *   3. EVERY NUMBER CARRIES ITS LEGAL SOURCE ({@code legalRef} on each metric), so
 *      the person can see WHY something matters — for example that a missing break
 *      is a Kodeks pracy art. 134 issue, not just an app warning.
 *
 * The server works out every clock (document expiry, the 30-day warning window,
 * the yearly 150-hour overtime cap, the whistleblower deadlines) exactly once, so
 * this screen can never disagree with the module apps or with the admin dashboard.
 */
public record MyOverviewResponse(

        // Who this workspace belongs to (always the signed-in person).
        Me me,

        // The few headline facts painted on the top row of cards.
        Headline headline,

        // Module codes the company's plan includes.
        List<String> entitledModules,

        // Module codes this person was granted. Anything outside this list is
        // reported as a card with no figures, and is never queried.
        List<String> grantedModules,

        // One card per module, in a fixed order. A card either carries the
        // person's own figures or says why it has none.
        List<ModuleCard> modules,

        // The person's own to-do list: their open obligations, worst first.
        List<AttentionItem> attention,

        // The person's own compliance documents (medical certificate, BHP
        // training) with their real expiry dates. Empty when the person has no
        // SafeWork access or no profile yet.
        List<MyDocument> documents,

        // What the company owes THIS PERSON in the way of information: where the
        // privacy notices are, who the data-protection officer is, and whether an
        // internal whistleblowing channel exists. See {@link Rights}.
        Rights rights,

        // The person's OWN newest audit lines across the modules — never anyone
        // else's. Lets someone check what has been recorded under their name.
        List<ActivityEntry> recentActivity,

        // When the server built this snapshot. Shown as "last updated" and used as
        // the provenance stamp on anything exported from the screen.
        Instant generatedAt) {

    // ── Who is asking ───────────────────────────────────────────────────────────
    //
    // Only the caller's OWN identity, taken from the verified session token. The
    // company name is included because a person may be a member of exactly one
    // company and the screen says which one.
    public record Me(
            String userId,
            String name,
            String email,
            String role,                 // ROLE_USER / ROLE_ADMIN / ROLE_SUPER_ADMIN
            String companyId,
            String companyName) {
    }

    /**
     * The top row of cards.
     *
     * Every field is allowed to be null, because a person may not have access to
     * the module the figure comes from. The browser simply leaves that card out
     * rather than showing a zero, which would read as "all fine".
     *
     * The values are NOT queried a second time: the service picks them out of the
     * module cards it has already built, so a figure here and the same figure on a
     * card can never disagree.
     */
    public record Headline(
            // WorkPulse — today and this month.
            String shiftStatusToday,      // NOT_STARTED / OPEN / ON_BREAK / COMPLETED / MISSING_CLOCK_OUT
            String workedHoursThisMonth,  // e.g. "126.5"
            String overtimeHoursThisMonth,

            // SafeWork — may this person legally work today?
            String documentStatus,        // COMPLIANT / EXPIRING / NON_COMPLIANT / BLOCKED / NO_PROFILE
            boolean blockedFromWork,

            // The person's own workload.
            int openActions,
            int overdueActions,

            // How many modules they can open, out of what the company pays for.
            int modulesAvailable,
            int modulesEntitled) {
    }

    /**
     * One of the person's own compliance documents.
     *
     * WHY IT IS ITS OWN BLOCK rather than just a metric: an employee needs the
     * actual expiry DATE and how many days are left, because Polish law forbids
     * them from working once either document lapses (Kodeks pracy art. 229 §4 for
     * the medical examination, art. 237(3) for BHP training). A plain count would
     * not tell them what to book, or when.
     *
     * NOTE ON WHAT IS NOT HERE: no medical findings, no diagnosis, no doctor —
     * only the validity dates SafeWork already stores. Health information is
     * special-category data (GDPR Art. 9), so even on the person's own screen the
     * API carries nothing beyond the dates and a status word.
     *
     * type     — MEDICAL_CERTIFICATE | BHP_TRAINING
     * status   — VALID | EXPIRING | EXPIRED | MISSING | NOT_REQUIRED
     * expiryDate     — "YYYY-MM-DD", or null when nothing was ever uploaded
     * daysRemaining  — whole days from today; negative when already expired
     */
    public record MyDocument(
            String type,
            String status,
            String expiryDate,
            Integer daysRemaining,
            boolean required,
            String legalRef) {
    }

    /**
     * The information the company owes this person, gathered in one place.
     *
     * WHY THIS IS ON AN EMPLOYEE'S DASHBOARD AND NOT ONLY A MANAGER'S:
     *
     *   * GDPR Art. 13–14 require the company to TELL people how their data is
     *     used, and Art. 13(1)(b) requires the contact details of the
     *     data-protection officer to be given to them. Putting that on the screen
     *     every employee opens is the plainest way to satisfy it.
     *
     *   * The Polish whistleblower act (ustawa z 14.06.2024 o ochronie
     *     sygnalistów, Dz.U. 2024 poz. 928, implementing dyrektywa (UE)
     *     2019/1937) requires the internal reporting procedure to be communicated
     *     to the people who may use it. A quiet channel nobody knows about does
     *     not meet that duty.
     *
     * IMPORTANT — THIS BLOCK IS NOT MODULE DATA. It carries no case figures and no
     * register contents: only "a notice exists", "here is the DPO's contact" and
     * "a reporting channel exists". It is therefore gated on the COMPANY's plan
     * rather than on the person's module grants, because these are the person's own
     * rights and not a feature they must be given access to.
     */
    public record Rights(
            // GDPR transparency (Art. 13–14).
            int privacyNoticesAvailable,
            Instant latestNoticeAt,
            String dpoName,
            String dpoEmail,
            String privacyRoute,           // where to read them inside RegulaOne

            // Whistleblowing (dyrektywa (UE) 2019/1937; ustawa o ochronie sygnalistów).
            boolean whistleblowingChannelAvailable,
            String whistleblowingRoute) {
    }

    /**
     * Shorthand so a caller does not have to build an empty response by hand.
     * Used when a person has no company yet — the screen then shows the setup
     * message instead of an error page.
     */
    public static MyOverviewResponse none(Me me, Instant generatedAt) {
        return new MyOverviewResponse(
                me,
                new Headline(null, null, null, null, false, 0, 0, 0, 0),
                List.of(), List.of(), List.of(), List.of(), List.of(),
                new Rights(0, null, null, null, null, false, null),
                List.of(),
                generatedAt);
    }
}
