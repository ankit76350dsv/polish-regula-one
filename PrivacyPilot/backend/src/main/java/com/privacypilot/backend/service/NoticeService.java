package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.notice.NoticeChecklistResponse;
import com.privacypilot.backend.dto.notice.NoticeGenerateRequest;
import com.privacypilot.backend.exception.NoticeIncompleteException;
import com.privacypilot.backend.model.document.PrivacyNotice;
import com.privacypilot.backend.model.document.ProcessingActivity;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import com.privacypilot.backend.model.enums.notice.NoticeAudience;
import com.privacypilot.backend.repository.PrivacyNoticeRepository;
import com.privacypilot.backend.repository.ProcessingActivityRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Business logic for privacy notices (klauzula informacyjna, Art. 13/14 GDPR).
 *
 * A privacy notice is COMPILED FROM THE REGISTER — it describes exactly what the
 * company's processing activities do with a given group of people's data. So this
 * service is tightly linked to {@link ProcessingActivityRepository}: it works out
 * which activities cover an audience and refuses to "publish" a notice the register
 * cannot actually back up.
 *
 * WHY the prose comes from the client (for now): a fully compliant notice also needs
 * the company's legal identity and DPO contact (Settings) plus vendor/transfer names
 * (Vendor/Transfer records). Those are not yet backend features, so the compiled text
 * is produced on the client and stored here. Everything that makes it trustworthy is
 * still server-owned: the register check, the covered-activity links, the version
 * number, the author, the timestamp and the immutable audit entry.
 */
@Service
@RequiredArgsConstructor
public class NoticeService {

    private final PrivacyNoticeRepository repository;
    private final ProcessingActivityRepository activityRepository;
    private final AuditService auditService;

    // Which data-subject groups (by their register code) each audience covers. Mirrors
    // the frontend's AUDIENCE_SUBJECTS so both sides agree on "who is this notice for".
    private static final Map<NoticeAudience, List<String>> AUDIENCE_SUBJECTS = Map.of(
            NoticeAudience.WEBSITE, List.of("website_users"),
            NoticeAudience.EMPLOYEES, List.of("employees"),
            NoticeAudience.CANDIDATES, List.of("candidates"),
            NoticeAudience.CONTRACTORS, List.of("contractors", "suppliers"),
            NoticeAudience.WHISTLEBLOWERS, List.of("whistleblowers"));

    // ── Reads ───────────────────────────────────────────────────────────────────

    /** Every notice (all audiences, all versions) for the caller's company, newest first. */
    public List<PrivacyNotice> list(AuthenticatedUser caller) {
        return repository.findByTenantIdAndDeletedFalseOrderByGeneratedAtDesc(caller.tenantId());
    }

    /** One notice, only if it belongs to the caller's company; otherwise 404. */
    public PrivacyNotice get(AuthenticatedUser caller, String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, caller.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notice not found"));
    }

    /**
     * The Art. 13/14 completeness check for one audience, computed from the REAL
     * register. The UI uses it to enable/disable the Generate button and to show what
     * still needs recording.
     */
    public NoticeChecklistResponse checklist(AuthenticatedUser caller, NoticeAudience audience) {
        List<ProcessingActivity> relevant = relevantActivities(caller, audience);
        List<NoticeChecklistResponse.Item> items = buildChecklist(audience, relevant);
        boolean blocked = items.stream().anyMatch(i -> !i.ok());
        List<String> activityIds = relevant.stream().map(ProcessingActivity::getId).toList();
        return new NoticeChecklistResponse(audience.getCode(), relevant.size(), activityIds, items, blocked);
    }

    // ── Writes ──────────────────────────────────────────────────────────────────

    /**
     * Generate (persist) a new version of the notice for an audience. Refuses when the
     * register cannot back the notice up (422 CHECKLIST_INCOMPLETE). The version, the
     * covered-activity links, the author and the timestamp are all set server-side.
     */
    public PrivacyNotice generate(AuthenticatedUser caller, NoticeGenerateRequest req, AuditContext ctx) {
        NoticeAudience audience = req.getAudience();
        List<ProcessingActivity> relevant = relevantActivities(caller, audience);

        // Server-side gate: only what the register can prove. If anything is missing,
        // stop with the list of failing GDPR references so the user knows what to fix.
        List<String> missing = buildChecklist(audience, relevant).stream()
                .filter(i -> !i.ok())
                .map(NoticeChecklistResponse.Item::ref)
                .toList();
        if (!missing.isEmpty()) {
            throw new NoticeIncompleteException(missing);
        }

        PrivacyNotice notice = new PrivacyNotice();
        notice.setTenantId(caller.tenantId());
        notice.setAudience(audience);
        notice.setLanguage(req.getLanguage());
        notice.setContent(req.getContent());
        notice.setTitle(resolveTitle(req.getTitle(), req.getContent()));
        // The true link back to the register: the ids of the activities this notice covers.
        notice.setActivityIds(relevant.stream().map(ProcessingActivity::getId).collect(
                java.util.stream.Collectors.toCollection(ArrayList::new)));
        // Next version for THIS audience (matches the frontend: versioning is per audience).
        notice.setVersion(nextVersion(caller, audience));
        // Author + moment are taken from the verified session / server clock, never the client.
        notice.setGeneratedBy(caller.name());
        notice.setGeneratedAt(Instant.now());

        PrivacyNotice saved = repository.save(notice);

        Map<String, Object> newValue = new LinkedHashMap<>();
        newValue.put("audience", saved.getAudience().getCode());
        newValue.put("version", saved.getVersion());
        auditService.record(ctx, AuditAction.GENERATE, AuditEntityType.NOTICE, saved.getId(),
                saved.getTitle(), null, newValue);
        return saved;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    // The live controller activities that concern this audience: role = controller, not
    // soft-deleted (the repository already excludes those), and at least one data-subject
    // group matching the audience.
    private List<ProcessingActivity> relevantActivities(AuthenticatedUser caller, NoticeAudience audience) {
        List<String> subjects = AUDIENCE_SUBJECTS.getOrDefault(audience, List.of());
        return activityRepository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(caller.tenantId()).stream()
                .filter(a -> a.getRole() != null && "controller".equals(a.getRole().getCode()))
                .filter(a -> a.getDataSubjects() != null
                        && a.getDataSubjects().stream().anyMatch(s -> subjects.contains(s.getCode())))
                .toList();
    }

    /**
     * Build the register-derived Art. 13/14 checklist for an audience. Mirrors the
     * frontend rules, but ONLY the items the server can verify from the register.
     * Identity items (controller/DPO) depend on Settings and are handled on the client.
     */
    private List<NoticeChecklistResponse.Item> buildChecklist(NoticeAudience audience,
                                                              List<ProcessingActivity> relevant) {
        boolean art13 = audience.getArt() == 13;
        boolean art14 = audience.getArt() == 14;
        List<NoticeChecklistResponse.Item> items = new ArrayList<>();

        // Purposes & lawful basis — there must be activities, and each must state both.
        if (relevant.isEmpty()) {
            items.add(item("purposes_basis", "Art. 13(1)(c)/14(1)(c)", false,
                    "No register activities cover this audience — record them first"));
        } else {
            String offenders = names(relevant, a -> isBlank(a.getPurpose()) || a.getLawfulBasis() == null);
            items.add(item("purposes_basis", "Art. 13(1)(c)/14(1)(c)", offenders.isEmpty(),
                    offenders.isEmpty() ? null : "Missing purpose/lawful basis: " + offenders));
        }

        // Legitimate interest — if used, it must be described.
        String liOffenders = names(relevant, a -> a.getLawfulBasis() != null
                && "legitimate_interest".equals(a.getLawfulBasis().getCode())
                && isBlank(a.getLegitimateInterestDetail()));
        items.add(item("legitimate_interest", "Art. 13(1)(d)", liOffenders.isEmpty(),
                liOffenders.isEmpty() ? null : "Describe the legitimate interest: " + liOffenders));

        // Recipients — always considered met (the notice lists categories from the register).
        items.add(item("recipients", "Art. 13(1)(e)/14(1)(e)", true, null));

        // Transfers — if a transfer is flagged, it must be linked to a transfer record.
        String trOffenders = names(relevant, a -> a.isTransfer()
                && (a.getTransferIds() == null || a.getTransferIds().isEmpty()));
        items.add(item("transfers", "Art. 13(1)(f)/14(1)(f)", trOffenders.isEmpty(),
                trOffenders.isEmpty() ? null : "Third-country transfer without a safeguard record: " + trOffenders));

        // Retention — each activity must state how long data is kept.
        String retOffenders = names(relevant, a -> isBlank(a.getRetentionPeriod()));
        items.add(item("retention", "Art. 13(2)(a)/14(2)(a)", retOffenders.isEmpty(),
                retOffenders.isEmpty() ? null : "Missing retention period: " + retOffenders));

        // Rights, withdraw-consent and complaint text are standard boilerplate → met.
        items.add(item("rights", "Art. 13(2)(b)/14(2)(c)", true, null));
        items.add(item("withdraw_consent", "Art. 13(2)(c)", true, null));
        items.add(item("complaint", "Art. 13(2)(d)/14(2)(e)", true, null));

        // Art. 13 only — was providing the data required, and what happens if not.
        if (art13) {
            String provOffenders = names(relevant, a -> isBlank(a.getProvisionStatement()));
            items.add(item("provision_requirement", "Art. 13(2)(e)", provOffenders.isEmpty(),
                    provOffenders.isEmpty() ? null : "State whether providing data is required: " + provOffenders));
        }

        // Art. 14 only — the categories of data and where it came from (not collected
        // directly from the person).
        if (art14) {
            boolean hasRelevant = !relevant.isEmpty();
            String catOffenders = names(relevant, a -> a.getDataCategories() == null || a.getDataCategories().isEmpty());
            items.add(item("data_categories", "Art. 14(1)(d)", hasRelevant && catOffenders.isEmpty(),
                    !hasRelevant ? "No activities cover this audience"
                            : catOffenders.isEmpty() ? null : "Missing data categories: " + catOffenders));
            String srcOffenders = names(relevant, a -> a.getDataSources() == null || a.getDataSources().isEmpty());
            items.add(item("source", "Art. 14(2)(f)", srcOffenders.isEmpty(),
                    srcOffenders.isEmpty() ? null : "Missing data source: " + srcOffenders));
        }

        return items;
    }

    // Next version number for one audience: latest existing + 1, or 1 if none yet.
    private int nextVersion(AuthenticatedUser caller, NoticeAudience audience) {
        return repository
                .findFirstByTenantIdAndAudienceAndDeletedFalseOrderByVersionDesc(caller.tenantId(), audience)
                .map(n -> n.getVersion() + 1)
                .orElse(1);
    }

    // Use the client's title when given; otherwise take the first Markdown heading line.
    private static String resolveTitle(String provided, String content) {
        if (provided != null && !provided.isBlank()) {
            return provided.trim();
        }
        String firstLine = content.strip().lines().findFirst().orElse("").strip();
        String stripped = firstLine.replaceFirst("^#+\\s*", "").strip();
        return stripped.isBlank() ? "Privacy notice" : stripped;
    }

    // Comma-joined names of the activities that match a "this is wrong" predicate.
    private static String names(List<ProcessingActivity> activities,
                                java.util.function.Predicate<ProcessingActivity> bad) {
        return activities.stream().filter(bad).map(ProcessingActivity::getName)
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private static NoticeChecklistResponse.Item item(String id, String ref, boolean ok, String details) {
        return new NoticeChecklistResponse.Item(id, ref, ok, details);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
