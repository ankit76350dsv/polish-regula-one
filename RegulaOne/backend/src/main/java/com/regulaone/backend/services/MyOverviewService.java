package com.regulaone.backend.services;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.ActivityEntry;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Metric;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.ModuleCard;
import com.regulaone.backend.dto.Dashboard.MyOverviewResponse;
import com.regulaone.backend.dto.Dashboard.MyOverviewResponse.Headline;
import com.regulaone.backend.dto.Dashboard.MyOverviewResponse.Me;
import com.regulaone.backend.dto.Dashboard.MyOverviewResponse.MyDocument;
import com.regulaone.backend.dto.Dashboard.MyOverviewResponse.Rights;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.TenantRepository;
import com.regulaone.backend.repository.UserRepository;
import com.regulaone.backend.repository.modules.ActivityFeedReader;
import com.regulaone.backend.repository.modules.personal.MyKsefFlowReader;
import com.regulaone.backend.repository.modules.personal.MyPrivacyPilotReader;
import com.regulaone.backend.repository.modules.personal.MyRightsReader;
import com.regulaone.backend.repository.modules.personal.MySafeVoiceReader;
import com.regulaone.backend.repository.modules.personal.MySafeWorkReader;
import com.regulaone.backend.repository.modules.personal.MyWasteSyncReader;
import com.regulaone.backend.repository.modules.personal.MyWorkPulseReader;
import com.regulaone.backend.repository.modules.personal.PersonalSnapshot;
import com.regulaone.backend.utils.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

/**
 * Builds the RegulaOne "My Workspace" dashboard: what ONE PERSON has to do, across
 * all six compliance modules.
 *
 * It is the personal counterpart of {@link CompanyOverviewService}. The two are
 * deliberately separate services because they answer different questions and obey a
 * different rule about scope:
 *
 *   CompanyOverviewService  →  "is my COMPANY compliant?"   → whole-company counts,
 *                                                             ROLE_ADMIN only.
 *   MyOverviewService       →  "am I in order?"              → the caller's OWN
 *                                                             records, any signed-in
 *                                                             member of a company.
 *
 * ── HOW IT DECIDES WHAT THE PERSON MAY SEE ──────────────────────────────────────
 *
 * Four gates, applied in this order, so the answer is always the narrowest one:
 *
 *   1. COMPANY. Taken from the signed-in user's own record, which is looked up from
 *      the verified session token. NEVER from the URL or a request body, so nobody
 *      can ask for another company's data by editing the address bar.
 *
 *   2. PLAN. A module the company does not pay for reports NOT_IN_PLAN and is not
 *      queried at all.
 *
 *   3. THE PERSON. A module they were not granted reports NO_ACCESS and is not
 *      queried. This is the same rule the sidebar uses, so the dashboard can never
 *      show more than the menu allows (least privilege).
 *
 *   4. THE PERSON AGAIN, INSIDE EVERY QUERY. This is the gate the company dashboard
 *      does not need: each reader also filters on the caller's own user id, so an
 *      employee with WorkPulse access sees their OWN shifts and not the team's.
 *
 *   SafeVoice has a FIFTH gate: whistleblower confidentiality is limited to
 *   authorised case handlers (dyrektywa (UE) 2019/1937 art. 16; ustawa o ochronie
 *   sygnalistów), so its card also requires a SafeVoice permission code. Without one
 *   the card comes back RESTRICTED and no whistleblower query is executed.
 *
 * ── WHAT THE NUMBERS ARE ────────────────────────────────────────────────────────
 *
 * The person's own counts, hours and dates — never an invented "score", and never
 * anybody else's record. Each reader documents exactly what it leaves out and why.
 *
 * ── RESILIENCE ──────────────────────────────────────────────────────────────────
 *
 * The modules are read in parallel on the shared dashboard pool, and each one is
 * wrapped so a failure becomes an UNAVAILABLE card instead of a failed page. An
 * employee must still be able to see that their medical certificate expires on
 * Friday when, say, the waste collections are unreachable.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MyOverviewService {

    /** How many audit lines to take from each module, and how many to return. */
    private static final int ACTIVITY_PER_MODULE = 5;
    private static final int ACTIVITY_TOTAL = 10;

    /**
     * Longest the dashboard waits for one module before giving up on it. Same
     * ceiling the company dashboard uses, so both screens behave alike under load.
     */
    private static final Duration MODULE_TIMEOUT = Duration.ofSeconds(12);

    /** Prefix of the SafeVoice staff permission codes (SAFEVOICE_ADMIN, …). */
    private static final String SAFEVOICE_PERMISSION_PREFIX = "SAFEVOICE_";

    /** Where the screen links people for their own rights and for reporting. */
    private static final String PRIVACY_ROUTE = "/modules/privacypilot";
    private static final String WHISTLEBLOWING_ROUTE = "/modules/safevoice";

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;

    private final MyWorkPulseReader workPulseReader;
    private final MySafeWorkReader safeWorkReader;
    private final MyKsefFlowReader ksefReader;
    private final MyWasteSyncReader wasteSyncReader;
    private final MyPrivacyPilotReader privacyPilotReader;
    private final MySafeVoiceReader safeVoiceReader;
    private final MyRightsReader rightsReader;

    // Reused from the company dashboard — the same audit sources, with an extra
    // "only this person" filter. See ActivityFeedReader#readForActor.
    private final ActivityFeedReader activityFeedReader;

    private final AuditLogService auditLogService;

    // The pool declared in DashboardConfig, shared with the company dashboard. The
    // field name matches the bean name, which is how Spring picks the right one.
    private final ThreadPoolTaskExecutor dashboardExecutor;

    /**
     * Assemble the whole personal workspace for the signed-in person.
     *
     * @param cognitoSub the subject claim of the verified session token — the only
     *                   thing trusted as an identity here
     * @param request    the live HTTP request, used solely to stamp the audit entry
     */
    public MyOverviewResponse build(String cognitoSub, HttpServletRequest request) {

        // ── Gate 1: who is asking, and which company are they in? ──────────────
        User caller = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String role = caller.getRole() != null ? caller.getRole().name() : Role.ROLE_USER.name();

        if (caller.getTenant() == null || caller.getTenant().getId() == null) {
            // Someone who has not been linked to a company yet (a brand-new invite, or
            // a platform super-admin who belongs to no single company). There is
            // nothing personal to show, so an EMPTY workspace is returned rather than
            // an error: the screen then explains the state instead of breaking.
            log.info("[my-overview] {} has no organisation — returning an empty workspace",
                    caller.getEmail());
            return MyOverviewResponse.none(
                    new Me(caller.getId(), caller.getName(), caller.getEmail(), role, null, null),
                    Instant.now());
        }

        String tenantId = caller.getTenant().getId();

        // Re-read the company so the plan and its package are freshly resolved rather
        // than trusting whatever the user document's reference carried.
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Organisation not found"));

        // ── Gates 2 and 3: plan entitlement, then this person's own access ──────
        Set<TenantModule> entitled = entitledModules(tenant);
        Set<TenantModule> granted = grantedModules(caller);
        boolean safeVoiceAuthorised = hasSafeVoicePermission(caller);

        // ── Read every module this person may see, in parallel ─────────────────
        Map<TenantModule, ModuleCard> cards = new EnumMap<>(TenantModule.class);
        List<AttentionItem> attention = new ArrayList<>();
        List<MyDocument> documents = new ArrayList<>();

        Map<TenantModule, CompletableFuture<PersonalSnapshot>> inFlight =
                new EnumMap<>(TenantModule.class);

        for (TenantModule module : TenantModule.values()) {
            String blocked = blockedReason(module, entitled, granted, safeVoiceAuthorised);
            if (blocked != null) {
                cards.put(module, new ModuleCard(module.name(), statusFor(blocked), blocked, List.of()));
                continue;
            }
            inFlight.put(module, readAsync(module, tenantId, caller.getId()));
        }

        for (Map.Entry<TenantModule, CompletableFuture<PersonalSnapshot>> entry : inFlight.entrySet()) {
            TenantModule module = entry.getKey();
            PersonalSnapshot snapshot = awaitQuietly(module, entry.getValue());

            if (snapshot == null) {
                // The module could not be read. Say so honestly instead of showing
                // zeroes, which a person would misread as "nothing to worry about".
                cards.put(module, new ModuleCard(module.name(), "UNAVAILABLE",
                        "MODULE_READ_FAILED", List.of()));
                continue;
            }

            cards.put(module, new ModuleCard(module.name(), "OK", null, snapshot.metrics()));
            attention.addAll(snapshot.attention());
            documents.addAll(snapshot.documents());
        }

        // Most serious first, then the biggest backlogs, then a stable name order so
        // repeated loads do not reshuffle the list.
        attention.sort(Comparator
                .comparingInt((AttentionItem item) -> toneRank(item.tone()))
                .thenComparing(Comparator.comparingInt(AttentionItem::count).reversed())
                .thenComparing(AttentionItem::type));

        // ── The person's own activity trail ────────────────────────────────────
        Set<String> visibleModuleCodes = new LinkedHashSet<>();
        cards.forEach((module, card) -> {
            if ("OK".equals(card.status())) visibleModuleCodes.add(module.name());
        });

        List<ActivityEntry> recentActivity = List.of();
        try {
            recentActivity = activityFeedReader.readForActor(
                    tenantId, caller.getId(), visibleModuleCodes,
                    ACTIVITY_PER_MODULE, ACTIVITY_TOTAL);
        } catch (RuntimeException ex) {
            log.warn("[my-overview] activity feed unavailable for user {}: {}",
                    caller.getId(), ex.getMessage());
        }

        // ── What the company owes this person ──────────────────────────────────
        Rights rights = buildRights(tenantId, entitled);

        // ── The top row, taken from the cards already built ────────────────────
        Headline headline = buildHeadline(cards, attention, granted.size(), entitled.size());

        // ── Record the read ────────────────────────────────────────────────────
        // The scope actually returned is stored, so the trail shows WHAT the person
        // was shown — not merely that they opened a page (GDPR Art. 5(2)).
        auditLogService.record(
                tenantId,
                caller.getId(),
                caller.getEmail(),
                role,
                "MY_OVERVIEW_VIEWED",
                "MY_OVERVIEW",
                caller.getId(),
                new ArrayList<>(visibleModuleCodes),
                request);

        return new MyOverviewResponse(
                new Me(caller.getId(), caller.getName(), caller.getEmail(), role,
                        tenant.getId(), tenant.getName()),
                headline,
                entitled.stream().map(TenantModule::name).toList(),
                granted.stream().map(TenantModule::name).toList(),
                List.copyOf(cards.values()),
                attention,
                documents,
                rights,
                recentActivity,
                Instant.now());
    }

    // ── Access decisions ────────────────────────────────────────────────────────

    /** Module codes the company's active subscription includes. */
    private Set<TenantModule> entitledModules(Tenant tenant) {
        Set<TenantModule> entitled = new LinkedHashSet<>();
        if (tenant.getCurrentPackage() != null
                && tenant.getCurrentPackage().getAppPackage() != null
                && tenant.getCurrentPackage().getAppPackage().getAppIds() != null) {
            entitled.addAll(tenant.getCurrentPackage().getAppPackage().getAppIds());
        }
        return entitled;
    }

    /** Module codes this particular person was granted. */
    private Set<TenantModule> grantedModules(User caller) {
        Set<TenantModule> granted = new LinkedHashSet<>();
        if (caller.getModuleIds() != null) granted.addAll(caller.getModuleIds());
        return granted;
    }

    /**
     * Does the caller hold any SafeVoice staff permission?
     *
     * Checked by prefix rather than against a fixed list, so a SafeVoice role added
     * later is picked up without a change here. Simply having the SafeVoice module in
     * the menu is deliberately NOT enough: handling reports is a separate authority.
     */
    private boolean hasSafeVoicePermission(User caller) {
        if (caller.getPermissions() == null) return false;
        return caller.getPermissions().stream()
                .anyMatch(code -> code != null && code.startsWith(SAFEVOICE_PERMISSION_PREFIX));
    }

    /**
     * Why this module must not be read — or null when it may be.
     *
     * Returning a reason code (rather than just true/false) lets the screen explain
     * the difference between "your company has not bought this" and "you were not
     * given access", which are very different conversations to have with an employee.
     */
    private String blockedReason(TenantModule module,
                                 Set<TenantModule> entitled,
                                 Set<TenantModule> granted,
                                 boolean safeVoiceAuthorised) {
        if (entitled.isEmpty()) return "NO_ACTIVE_PLAN";
        if (!entitled.contains(module)) return "NOT_IN_PLAN";
        if (!granted.contains(module)) return "MODULE_NOT_GRANTED";
        if (module == TenantModule.SAFEVOICE && !safeVoiceAuthorised) {
            return "SAFEVOICE_PERMISSION_REQUIRED";
        }
        return null;
    }

    /** Maps a block reason to the card status the frontend switches on. */
    private String statusFor(String reason) {
        return switch (reason) {
            case "NO_ACTIVE_PLAN", "NOT_IN_PLAN" -> "NOT_IN_PLAN";
            case "SAFEVOICE_PERMISSION_REQUIRED" -> "RESTRICTED";
            default -> "NO_ACCESS";
        };
    }

    // ── Parallel module reads ───────────────────────────────────────────────────

    /**
     * Start one module's personal read on the dashboard thread pool.
     *
     * Every reader is handed the company id AND the user id explicitly, so the
     * "only my records" rule does not depend on any thread-local state surviving the
     * hop onto another thread.
     */
    private CompletableFuture<PersonalSnapshot> readAsync(TenantModule module,
                                                          String tenantId,
                                                          String userId) {
        Supplier<PersonalSnapshot> reader = switch (module) {
            case KSEFFLOW -> () -> ksefReader.read(tenantId, userId);
            case WORKPULSE -> () -> workPulseReader.read(tenantId, userId);
            // SafeWork records carry no tenantId; they are found BY the user id, which
            // can only be the caller's own — see MySafeWorkReader.
            case SAFEWORK -> () -> safeWorkReader.read(userId);
            case SAFEVOICE -> () -> safeVoiceReader.read(tenantId, userId);
            case WASTESYNC -> () -> wasteSyncReader.read(tenantId, userId);
            case PRIVACYPILOT -> () -> privacyPilotReader.read(tenantId, userId);
        };
        return CompletableFuture.supplyAsync(reader, dashboardExecutor);
    }

    /**
     * Wait for one module, but never longer than {@link #MODULE_TIMEOUT}, and never
     * let its failure escape. Returns null when the module could not be read.
     */
    private PersonalSnapshot awaitQuietly(TenantModule module,
                                          CompletableFuture<PersonalSnapshot> future) {
        try {
            return future.get(MODULE_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            // Preserve the interrupt so the container can shut the thread down.
            Thread.currentThread().interrupt();
            log.warn("[my-overview] interrupted while reading module {}", module);
            return null;
        } catch (Exception ex) {
            log.warn("[my-overview] module {} could not be read: {}", module, ex.getMessage());
            return null;
        }
    }

    // ── The person's own blocks ─────────────────────────────────────────────────

    /**
     * The information the company owes this person.
     *
     * GATED ON THE COMPANY'S PLAN, NOT ON THE PERSON'S MODULE GRANTS — on purpose.
     * Being told how your data is used (GDPR Art. 13–14), who the data-protection
     * officer is (Art. 13(1)(b)) and that an internal whistleblowing channel exists
     * (ustawa o ochronie sygnalistów; dyrektywa (UE) 2019/1937) are the person's own
     * RIGHTS. They are not module features that somebody must first be granted, so
     * withholding them until an admin ticks a module box would be the wrong default.
     *
     * Nothing here is case data or register content: only "a notice exists", "here is
     * the officer's contact" and "a channel exists".
     */
    private Rights buildRights(String tenantId, Set<TenantModule> entitled) {
        MyRightsReader.Transparency transparency = MyRightsReader.Transparency.none();

        if (entitled.contains(TenantModule.PRIVACYPILOT)) {
            try {
                transparency = rightsReader.read(tenantId);
            } catch (RuntimeException ex) {
                // A failure here must not cost the person the rest of their workspace.
                log.warn("[my-overview] transparency block unavailable for tenant {}: {}",
                        tenantId, ex.getMessage());
            }
        }

        boolean whistleblowing = entitled.contains(TenantModule.SAFEVOICE);

        return new Rights(
                (int) transparency.noticeCount(),
                transparency.latestAt(),
                transparency.dpoName(),
                transparency.dpoEmail(),
                entitled.contains(TenantModule.PRIVACYPILOT) ? PRIVACY_ROUTE : null,
                whistleblowing,
                whistleblowing ? WHISTLEBLOWING_ROUTE : null);
    }

    /**
     * The top row of cards.
     *
     * Nothing is queried again here: the figures are picked out of the module cards
     * that were just built. A number on the top row and the same number on a card can
     * therefore never disagree, which is the whole reason this method looks the way
     * it does.
     */
    private Headline buildHeadline(Map<TenantModule, ModuleCard> cards,
                                   List<AttentionItem> attention,
                                   int modulesAvailable,
                                   int modulesEntitled) {

        String shiftStatus = metricValue(cards, TenantModule.WORKPULSE, "my.workpulse.today.status");
        String workedHours = metricValue(cards, TenantModule.WORKPULSE, "my.workpulse.month.workedHours");
        String overtimeHours = metricValue(cards, TenantModule.WORKPULSE, "my.workpulse.month.overtimeHours");

        String documentStatus = metricValue(cards, TenantModule.SAFEWORK, "my.safework.profile.status");
        boolean blocked = "1".equals(metricValue(cards, TenantModule.SAFEWORK, "my.safework.blocked"));

        // Every open item, and how many of those are already a legal problem.
        int open = 0;
        int overdue = 0;
        for (AttentionItem item : attention) {
            open += item.count();
            if ("RISK".equals(item.tone())) overdue += item.count();
        }

        return new Headline(shiftStatus, workedHours, overtimeHours,
                documentStatus, blocked, open, overdue, modulesAvailable, modulesEntitled);
    }

    /**
     * One metric's plain value out of an already-built card, or null when the person
     * has no access to that module (so the screen leaves the tile out rather than
     * showing a zero that reads as "all fine").
     */
    private String metricValue(Map<TenantModule, ModuleCard> cards,
                               TenantModule module,
                               String key) {
        ModuleCard card = cards.get(module);
        if (card == null || !"OK".equals(card.status())) return null;
        for (Metric metric : card.metrics()) {
            if (key.equals(metric.key())) return metric.value();
        }
        return null;
    }

    /** RISK sorts above WARN, which sorts above everything else. */
    private int toneRank(String tone) {
        if ("RISK".equals(tone)) return 0;
        if ("WARN".equals(tone)) return 1;
        return 2;
    }
}
