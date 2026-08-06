package com.regulaone.backend.dashboard;

import com.regulaone.backend.common.ResourceNotFoundException;
import com.regulaone.backend.common.audit.AuditLogService;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.ActivityEntry;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Company;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Headline;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.ModuleCard;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.MonthPoint;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Plan;
import com.regulaone.backend.dashboard.reader.ActivityFeedReader;
import com.regulaone.backend.dashboard.reader.KsefFlowMetricsReader;
import com.regulaone.backend.dashboard.reader.ModuleSnapshot;
import com.regulaone.backend.dashboard.reader.PrivacyPilotMetricsReader;
import com.regulaone.backend.dashboard.reader.SafeVoiceMetricsReader;
import com.regulaone.backend.dashboard.reader.SafeWorkMetricsReader;
import com.regulaone.backend.dashboard.reader.WasteSyncMetricsReader;
import com.regulaone.backend.dashboard.reader.WorkPulseMetricsReader;
import com.regulaone.backend.dashboard.support.ModuleAccessPolicy;
import com.regulaone.backend.dashboard.support.ModuleReads;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.User;
import com.regulaone.backend.tenant.TenantRepository;
import com.regulaone.backend.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;

/**
 * Builds the RegulaOne company-admin dashboard: one compliance picture of the
 * whole company, drawn from all six modules.
 *
 * ── HOW IT DECIDES WHAT THE ADMIN MAY SEE ───────────────────────────────────────
 *
 *   1. COMPANY — decided here. The company id comes from the signed-in user's own
 *      record, looked up from the verified session token. It is NEVER taken from the
 *      URL or a request body, so an admin cannot ask for another company's numbers by
 *      editing the address bar.
 *
 *   2. PLAN, THE PERSON, and the extra SafeVoice authorisation — decided by
 *      {@link ModuleAccessPolicy}, which the personal dashboard uses too so the two
 *      screens can never disagree about who may see what.
 *
 * ── WHAT THE NUMBERS ARE ────────────────────────────────────────────────────────
 *
 * Counts, totals and deadlines — never personal data, and never an invented "score".
 * Each module reader documents exactly what it leaves out and why.
 *
 * ── RESILIENCE ──────────────────────────────────────────────────────────────────
 *
 * The six modules are read in parallel, and each one is wrapped so a failure becomes
 * an UNAVAILABLE card instead of a failed page. A company must still be able to see
 * its KSeF deadlines when, say, the waste collections are unreachable.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompanyOverviewService {

    /** A plan inside this many days of expiry is flagged as expiring soon. */
    private static final int PLAN_WARNING_DAYS = 30;

    /** Months of KSeF invoice history shown on the trend chart. */
    private static final int INVOICE_CHART_MONTHS = 12;

    /** How many audit lines to take from each module, and how many to return. */
    private static final int ACTIVITY_PER_MODULE = 6;
    private static final int ACTIVITY_TOTAL = 12;

    /** Prefix on this service's log lines. */
    private static final String LOG = "dashboard";

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;

    private final KsefFlowMetricsReader ksefReader;
    private final WorkPulseMetricsReader workPulseReader;
    private final SafeWorkMetricsReader safeWorkReader;
    private final SafeVoiceMetricsReader safeVoiceReader;
    private final WasteSyncMetricsReader wasteSyncReader;
    private final PrivacyPilotMetricsReader privacyPilotReader;
    private final ActivityFeedReader activityFeedReader;

    private final AuditLogService auditLogService;

    // The pool declared in DashboardConfig. The field name matches the bean name,
    // which is how Spring picks the right one if another executor is ever added.
    private final ThreadPoolTaskExecutor dashboardExecutor;

    /**
     * Assemble the whole dashboard for the signed-in administrator.
     *
     * @param cognitoSub the subject claim of the verified session token — the only
     *                   thing trusted as an identity here
     * @param request    the live HTTP request, used solely to stamp the audit entry
     */
    public CompanyOverviewResponse build(String cognitoSub, HttpServletRequest request) {

        // ── Gate 1: who is asking, and which company are they in? ──────────────
        User caller = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (caller.getTenant() == null || caller.getTenant().getId() == null) {
            // A brand-new admin has no organisation until they finish the setup
            // flow. The frontend already shows a setup modal for this state.
            throw new IllegalStateException(
                    "Your organisation is not set up yet. Complete organisation setup first.");
        }

        String tenantId = caller.getTenant().getId();

        // Re-read the company so the plan and its package are freshly resolved
        // rather than relying on whatever the user document's reference carried.
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Organisation not found"));

        // ── Gates 2 and 3: plan entitlement, then this person's own access ──────
        Set<TenantModule> entitled = ModuleAccessPolicy.entitledModules(tenant);
        Set<TenantModule> granted = ModuleAccessPolicy.grantedModules(caller);
        boolean safeVoiceAuthorised = ModuleAccessPolicy.hasSafeVoicePermission(caller);

        // ── Read every module the admin may see, in parallel ───────────────────
        Map<TenantModule, ModuleCard> cards = new EnumMap<>(TenantModule.class);
        List<AttentionItem> attention = new ArrayList<>();

        Map<TenantModule, CompletableFuture<ModuleSnapshot>> inFlight =
                new EnumMap<>(TenantModule.class);

        for (TenantModule module : TenantModule.values()) {
            String blocked = ModuleAccessPolicy.blockedReason(
                    module, entitled, granted, safeVoiceAuthorised);
            if (blocked != null) {
                cards.put(module, new ModuleCard(module.name(),
                        ModuleAccessPolicy.statusFor(blocked), blocked, List.of()));
                continue;
            }
            inFlight.put(module, readAsync(module, tenantId));
        }

        for (Map.Entry<TenantModule, CompletableFuture<ModuleSnapshot>> entry : inFlight.entrySet()) {
            TenantModule module = entry.getKey();
            ModuleSnapshot snapshot = ModuleReads.awaitQuietly(module, entry.getValue(), log, LOG);

            if (snapshot == null) {
                // The module could not be read. Say so honestly instead of showing
                // zeroes, which an admin would misread as "nothing to worry about".
                cards.put(module, new ModuleCard(module.name(), "UNAVAILABLE",
                        "MODULE_READ_FAILED", List.of()));
                continue;
            }

            cards.put(module, new ModuleCard(module.name(), "OK", null, snapshot.metrics()));
            attention.addAll(snapshot.attention());
        }

        ModuleReads.sortByUrgency(attention);

        // ── KSeF trend chart — only when the admin may see KSeFFlow ────────────
        List<MonthPoint> invoiceVolume = List.of();
        if ("OK".equals(cards.get(TenantModule.KSEFFLOW).status())) {
            try {
                invoiceVolume = ksefReader.invoiceVolume(tenantId, INVOICE_CHART_MONTHS);
            } catch (RuntimeException ex) {
                log.warn("[{}] invoice volume chart unavailable for tenant {}: {}",
                        LOG, tenantId, ex.getMessage());
            }
        }

        // ── Cross-module activity feed (SafeVoice excluded inside the reader) ───
        Set<String> visibleModuleCodes = new LinkedHashSet<>();
        cards.forEach((module, card) -> {
            if ("OK".equals(card.status())) visibleModuleCodes.add(module.name());
        });

        List<ActivityEntry> recentActivity = List.of();
        try {
            recentActivity = activityFeedReader.read(
                    tenantId, visibleModuleCodes, ACTIVITY_PER_MODULE, ACTIVITY_TOTAL);
        } catch (RuntimeException ex) {
            log.warn("[{}] activity feed unavailable for tenant {}: {}",
                    LOG, tenantId, ex.getMessage());
        }

        // ── RegulaOne's own blocks: company, plan, people ───────────────────────
        Plan plan = buildPlan(tenant);
        Headline headline = buildHeadline(tenantId, plan, visibleModuleCodes.size(),
                entitled.size(), attention);

        // ── Record the read ────────────────────────────────────────────────────
        // The scope actually returned is stored, so the trail shows WHAT the person
        // was shown — not merely that they opened a page.
        auditLogService.record(
                tenantId,
                caller.getId(),
                caller.getEmail(),
                caller.getRole() != null ? caller.getRole().name() : Role.ROLE_USER.name(),
                "COMPANY_OVERVIEW_VIEWED",
                "COMPANY_OVERVIEW",
                tenantId,
                new ArrayList<>(visibleModuleCodes),
                request);

        return new CompanyOverviewResponse(
                buildCompany(tenant),
                plan,
                headline,
                entitled.stream().map(TenantModule::name).toList(),
                List.copyOf(cards.values()),
                attention,
                invoiceVolume,
                recentActivity,
                Instant.now());
    }

    // ── Parallel module reads ───────────────────────────────────────────────────

    /** Start one module's read on the dashboard thread pool. */
    private CompletableFuture<ModuleSnapshot> readAsync(TenantModule module, String tenantId) {
        Function<String, ModuleSnapshot> reader = switch (module) {
            case KSEFFLOW -> ksefReader::read;
            case WORKPULSE -> workPulseReader::read;
            case SAFEWORK -> safeWorkReader::read;
            case SAFEVOICE -> safeVoiceReader::read;
            case WASTESYNC -> wasteSyncReader::read;
            case PRIVACYPILOT -> privacyPilotReader::read;
        };
        return CompletableFuture.supplyAsync(() -> reader.apply(tenantId), dashboardExecutor);
    }

    // ── RegulaOne's own blocks ──────────────────────────────────────────────────

    private Company buildCompany(Tenant tenant) {
        return new Company(
                tenant.getId(),
                tenant.getName(),
                tenant.getNip(),
                tenant.getRegon(),
                tenant.getCity(),
                tenant.getStatus() != null ? tenant.getStatus().name() : null,
                tenant.getCreatedAt());
    }

    /**
     * The subscription block.
     *
     * The plan matters for compliance, not just billing: when it lapses the company
     * loses the tools it files invoices and government reports with, so the expiry
     * clock belongs on a compliance dashboard.
     */
    private Plan buildPlan(Tenant tenant) {
        Tenant.PackageDetails current = tenant.getCurrentPackage();
        if (current == null) {
            return new Plan(null, null, null, null, false, false, null);
        }

        String packageName = current.getAppPackage() != null
                ? current.getAppPackage().getName()
                : null;

        LocalDateTime expiring = current.getPlanExpiring();
        Integer daysRemaining = null;
        boolean expired = false;
        boolean expiringSoon = false;

        if (expiring != null) {
            // Counted in whole days on the company's local calendar, so "expires
            // today" reads as 0 rather than a confusing fraction.
            long days = java.time.temporal.ChronoUnit.DAYS.between(
                    LocalDate.now(WARSAW), expiring.toLocalDate());
            daysRemaining = (int) days;
            expired = days < 0;
            expiringSoon = !expired && days <= PLAN_WARNING_DAYS;
        }

        // usersCapacity is stored as text on the assignment (it may say "Unlimited"),
        // so it is only reported as a number when it really is one.
        Integer capacity = parseCapacity(current.getUsersCapacity());

        return new Plan(packageName, current.getPlanStarted(), expiring,
                daysRemaining, expired, expiringSoon, capacity);
    }

    /**
     * The top row of stat cards.
     *
     * User figures come from ONE read of the company's user list, counted in memory:
     * a company has tens or hundreds of users, so a single query beats four separate
     * count round trips.
     */
    private Headline buildHeadline(String tenantId,
                                   Plan plan,
                                   int modulesVisible,
                                   int modulesEntitled,
                                   List<AttentionItem> attention) {

        List<User> users = userRepository.findByTenant_Id(tenantId);

        LocalDateTime monthStart = LocalDate.now(WARSAW).withDayOfMonth(1).atStartOfDay();

        int active = 0;
        int disabled = 0;
        int newThisMonth = 0;
        for (User user : users) {
            if (user.isEnabled()) active++;
            else disabled++;
            if (user.getCreatedAt() != null && !user.getCreatedAt().isBefore(monthStart)) {
                newThisMonth++;
            }
        }

        Integer capacity = plan.usersCapacity();
        Integer seatsRemaining = capacity != null ? Math.max(0, capacity - active) : null;

        // Every open obligation, and how many of those are already a legal breach.
        ModuleReads.OpenWork work = ModuleReads.countOpenWork(attention);

        return new Headline(active, disabled, capacity, seatsRemaining, newThisMonth,
                modulesVisible, modulesEntitled, work.open(), work.overdue(),
                plan.daysRemaining());
    }

    /**
     * Seat capacity as a number, or null when it is not one.
     * The field is free text, so values like "Unlimited" must not crash the page.
     */
    private Integer parseCapacity(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Integer.valueOf(raw.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
