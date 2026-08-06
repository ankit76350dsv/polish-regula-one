package com.regulaone.backend.dashboard.dto;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Everything the RegulaOne company-admin dashboard shows, in ONE response.
 *
 * SIMPLE EXPLANATION (what this is for):
 *   A company admin logs in to RegulaOne and wants one page that answers
 *   "is my company compliant today?" across all six compliance apps
 *   (KSeFFlow, WorkPulse, SafeWork, SafeVoice, WasteSync, PrivacyPilot).
 *   This one response carries those answers so the browser makes a single call.
 *
 * WHY THE SHAPE LOOKS LIKE THIS — three rules it must obey:
 *
 *   1. AGGREGATES ONLY (GDPR Art. 5(1)(c) — data minimisation).
 *      Every module figure here is a COUNT, a TOTAL, or a DEADLINE. No employee
 *      names, no PESEL, no medical details, no absence reasons, no whistleblower
 *      case text, no buyer lists. The admin already has the module apps for
 *      record-level work; the oversight dashboard does not need identities.
 *
 *   2. EVERY NUMBER IS A REAL FACT.
 *      Nothing is invented. There is no made-up "compliance score" — instead the
 *      dashboard reports how many concrete legal obligations are currently open
 *      or overdue, which is what an inspector would actually ask about.
 *
 *   3. EVERY NUMBER CARRIES ITS LEGAL SOURCE ({@code legalRef}).
 *      So the screen can say WHY a number matters (e.g. "72 h — RODO art. 33")
 *      and an auditor can trace each figure back to the rule behind it.
 *
 * The server computes all the legal clocks (72-hour breach window, 7-day
 * whistleblower acknowledgement, 30-day certificate warning, plan expiry) ONCE,
 * so every screen and export shows the same authoritative numbers.
 *
 * All reads are scoped to the caller's own tenant, taken from the verified
 * session — never from the URL — so one company can never see another's data.
 */
public record CompanyOverviewResponse(

        // Who this dashboard is about (the admin's own company).
        Company company,

        // The subscription that decides which modules the company may use.
        Plan plan,

        // The few headline numbers painted on the top row of stat cards.
        Headline headline,

        // Module codes included in the company's plan (e.g. ["KSEFFLOW", ...]).
        List<String> entitledModules,

        // One card per module, in a fixed order. A card can also say "you have no
        // access" or "the module could not be read" instead of carrying numbers.
        List<ModuleCard> modules,

        // The cross-module "needs attention" list: grouped legal obligations that
        // are open or overdue right now. Counts only — no personal data.
        List<AttentionItem> attention,

        // KSeF invoice volume for the last 12 months (for the trend chart).
        // Empty when the admin has no KSeFFlow access.
        List<MonthPoint> invoiceVolume,

        // Newest cross-module audit lines (accountability, GDPR Art. 5(2)).
        // SafeVoice is deliberately EXCLUDED — see ActivityEntry.
        List<ActivityEntry> recentActivity,

        // When the server built this snapshot. Shown as "last updated" and used
        // as the provenance stamp on any export taken from the screen.
        Instant generatedAt) {

    // ── Company identity ────────────────────────────────────────────────────────
    //
    // Read from the shared "tenants" collection, which is the single source of
    // truth for the company's legal identity across every RegulaOne module.
    // NIP / REGON are the Polish tax and business-registry numbers; they appear
    // on invoices and government reports, so the admin needs to see them.
    public record Company(
            String id,
            String name,
            String nip,
            String regon,
            String city,
            String status,               // ACTIVE / INACTIVE / SUSPENDED
            LocalDateTime createdAt) {
    }

    // ── Subscription plan ───────────────────────────────────────────────────────
    //
    // Included because an expired plan is itself a compliance risk: if the
    // subscription lapses, the company stops filing invoices and reports on time.
    // The price is NOT included — the billing page owns that.
    public record Plan(
            String packageName,
            LocalDateTime planStarted,
            LocalDateTime planExpiring,
            Integer daysRemaining,      // null when the plan has no expiry date
            boolean expired,
            boolean expiringSoon,       // within 30 days
            Integer usersCapacity) {    // seats the plan allows; null if unlimited
    }

    // ── Top row of stat cards ───────────────────────────────────────────────────
    public record Headline(
            // People: how many accounts can currently sign in, and seat usage.
            int activeUsers,
            int disabledUsers,
            Integer seatsCapacity,      // from the plan (null = unlimited)
            Integer seatsRemaining,     // null when capacity is unlimited
            int newUsersThisMonth,

            // Modules: how many the admin can actually see vs how many are paid for.
            int modulesVisible,
            int modulesEntitled,

            // Compliance workload: how many obligations are open, and how many of
            // those are already overdue / legally risky (tone = RISK).
            int openComplianceActions,
            int overdueComplianceActions,

            // Plan clock, repeated here so the card row needs nothing else.
            Integer planDaysRemaining) {
    }

    // ── One module's card ───────────────────────────────────────────────────────
    //
    // status values and what they mean:
    //   OK          — numbers were read successfully; {@code metrics} is filled.
    //   NOT_IN_PLAN — the company's subscription does not include this module.
    //   NO_ACCESS   — in the plan, but this admin was not granted the module.
    //   RESTRICTED  — extra confidentiality rules apply and the caller does not
    //                 hold the required module permission (SafeVoice only).
    //   UNAVAILABLE — the module's data could not be read right now. The rest of
    //                 the dashboard still works; only this card degrades.
    public record ModuleCard(
            String module,              // TenantModule code, e.g. "KSEFFLOW"
            String status,
            String statusReason,        // short machine code the UI can translate
            List<Metric> metrics) {
    }

    /**
     * One fact on a module card.
     *
     * key      — machine name the frontend turns into a Polish/English label
     *            (e.g. "ksef.invoices.failed"). Never pre-translated text.
     * value    — the plain machine value as text: "12", "84", "2026-09-30",
     *            "1240.50". The frontend formats it using {@code unit}.
     * unit     — COUNT | PERCENT | HOURS | KG | DATE | MONEY | TEXT.
     * tone     — NEUTRAL | GOOD | WARN | RISK. Drives the colour only.
     * legalRef — the rule this number exists for, e.g. "Kodeks pracy art. 134".
     *            null for purely operational figures with no legal deadline.
     */
    public record Metric(
            String key,
            String value,
            String unit,
            String tone,
            String legalRef) {

        /** Shorthand for a plain count with no legal reference. */
        public static Metric count(String key, long value) {
            return new Metric(key, Long.toString(value), "COUNT", "NEUTRAL", null);
        }

        /** A count whose colour and legal source both matter. */
        public static Metric count(String key, long value, String tone, String legalRef) {
            return new Metric(key, Long.toString(value), "COUNT", tone, legalRef);
        }
    }

    /**
     * One grouped item in the cross-module "needs attention" list.
     *
     * It is a COUNT of records that share the same open obligation — never the
     * records themselves. That keeps personal data out of the dashboard while
     * still telling the admin exactly what to go and fix.
     *
     * module   — which app the work lives in ("PRIVACYPILOT").
     * type     — what the obligation is ("BREACH_UODO_OVERDUE"). The frontend
     *            translates this into a sentence.
     * count    — how many records are in this state.
     * tone     — RISK (a legal deadline is breached or breaching) or WARN.
     * legalRef — the rule behind it.
     * to       — relative route to the module inside RegulaOne, so the card can
     *            deep-link the admin to where the work is done.
     */
    public record AttentionItem(
            String module,
            String type,
            int count,
            String tone,
            String legalRef,
            String to) {
    }

    /** One point on the KSeF invoice-volume chart. month is "YYYY-MM". */
    public record MonthPoint(String month, long count) {
    }

    /**
     * One line in the cross-module recent-activity feed.
     *
     * Deliberately narrow: WHO did WHAT, WHERE, WHEN, and did it succeed. The
     * audit records' {@code oldValue}/{@code newValue} payloads are NOT copied
     * here — they can contain health data, absence reasons or case content, none
     * of which belongs on an overview screen (GDPR Art. 5(1)(c)).
     *
     * SafeVoice audit lines are excluded from this feed entirely: they reveal who
     * is handling which whistleblower case, and confidentiality there is limited
     * to the authorised case handlers (Directive (EU) 2019/1937 Art. 16; ustawa
     * o ochronie sygnalistów). A company admin is not automatically one of them.
     */
    public record ActivityEntry(
            String module,
            String actor,               // acting user's email, or "SYSTEM"
            String action,              // module action code, e.g. "CLOCK_IN"
            String resource,            // entity type only, e.g. "TimeEntry"
            Instant at,
            boolean success) {
    }
}
