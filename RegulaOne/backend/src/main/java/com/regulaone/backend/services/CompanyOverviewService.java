package com.regulaone.backend.services;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.ActivityEntry;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Company;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Headline;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.ModuleCard;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.MonthPoint;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Plan;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.TenantRepository;
import com.regulaone.backend.repository.UserRepository;
import com.regulaone.backend.repository.modules.ActivityFeedReader;
import com.regulaone.backend.repository.modules.KsefFlowMetricsReader;
import com.regulaone.backend.repository.modules.ModuleSnapshot;
import com.regulaone.backend.repository.modules.PrivacyPilotMetricsReader;
import com.regulaone.backend.repository.modules.SafeVoiceMetricsReader;
import com.regulaone.backend.repository.modules.SafeWorkMetricsReader;
import com.regulaone.backend.repository.modules.WasteSyncMetricsReader;
import com.regulaone.backend.repository.modules.WorkPulseMetricsReader;
import com.regulaone.backend.utils.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
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
 * Three gates, applied in this order, so the answer is always the narrowest one:
 *
 *   1. COMPANY. The company id comes from the signed-in user's own record, which
 *      is looked up from the verified session token. It is NEVER taken from the URL
 *      or a request body, so an admin cannot ask for another company's numbers by
 *      editing the address bar.
 *
 *   2. PLAN. A module the company does not pay for reports NOT_IN_PLAN and is not
 *      queried at all.
 *
 *   3. THE PERSON. A module the admin was not granted reports NO_ACCESS and is not
 *      queried. This is the same rule the sidebar uses, so the dashboard can never
 *      show more than the menu allows (least privilege).
 *
 *   SafeVoice has a FOURTH gate: whistleblower confidentiality is limited to
 *   authorised case handlers (dyrektywa (UE) 2019/1937 art. 16; ustawa o ochronie
 *   sygnalistów), so its card also requires a SafeVoice staff permission. Without
 *   one the card comes back RESTRICTED and no whistleblower query is executed.
 *
 * ── WHAT THE NUMBERS ARE ────────────────────────────────────────────────────────
 *
 * Counts, totals and deadlines — never personal data, and never an invented
 * "score". Each module reader documents exactly what it leaves out and why.
 *
 * ── RESILIENCE ──────────────────────────────────────────────────────────────────
 *
 * The six modules are read in parallel, and each one is wrapped so a failure
 * becomes an UNAVAILABLE card instead of a failed page. A company must still be
 * able to see its KSeF deadlines when, say, the waste collections are unreachable.
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

    /**
     * Longest the dashboard waits for one module before giving up on it. Chosen so
     * a hanging collection cannot hold the whole page open indefinitely.
     */
    private static final Duration MODULE_TIMEOUT = Duration.ofSeconds(12);

    /** Prefix of the SafeVoice staff permission codes (SAFEVOICE_ADMIN, …). */
    private static final String SAFEVOICE_PERMISSION_PREFIX = "SAFEVOICE_";

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
        Set<TenantModule> entitled = entitledModules(tenant);
        Set<TenantModule> granted = grantedModules(caller);
        boolean safeVoiceAuthorised = hasSafeVoicePermission(caller);

        // ── Read every module the admin may see, in parallel ───────────────────
        Map<TenantModule, ModuleCard> cards = new EnumMap<>(TenantModule.class);
        List<AttentionItem> attention = new ArrayList<>();

        Map<TenantModule, CompletableFuture<ModuleSnapshot>> inFlight =
                new EnumMap<>(TenantModule.class);

        for (TenantModule module : TenantModule.values()) {
            String blocked = blockedReason(module, entitled, granted, safeVoiceAuthorised);
            if (blocked != null) {
                cards.put(module, new ModuleCard(module.name(), statusFor(blocked), blocked, List.of()));
                continue;
            }
            inFlight.put(module, readAsync(module, tenantId));
        }

        for (Map.Entry<TenantModule, CompletableFuture<ModuleSnapshot>> entry : inFlight.entrySet()) {
            TenantModule module = entry.getKey();
            ModuleSnapshot snapshot = awaitQuietly(module, entry.getValue());

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

        // Most serious first, then the biggest backlogs, then a stable name order so
        // repeated loads do not reshuffle the list.
        attention.sort(Comparator
                .comparingInt((AttentionItem item) -> toneRank(item.tone()))
                .thenComparing(Comparator.comparingInt(AttentionItem::count).reversed())
                .thenComparing(AttentionItem::type));

        // ── KSeF trend chart — only when the admin may see KSeFFlow ────────────
        List<MonthPoint> invoiceVolume = List.of();
        if ("OK".equals(cards.get(TenantModule.KSEFFLOW).status())) {
            try {
                invoiceVolume = ksefReader.invoiceVolume(tenantId, INVOICE_CHART_MONTHS);
            } catch (RuntimeException ex) {
                log.warn("[dashboard] invoice volume chart unavailable for tenant {}: {}",
                        tenantId, ex.getMessage());
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
            log.warn("[dashboard] activity feed unavailable for tenant {}: {}",
                    tenantId, ex.getMessage());
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

    /** Module codes this particular administrator was granted. */
    private Set<TenantModule> grantedModules(User caller) {
        Set<TenantModule> granted = new LinkedHashSet<>();
        if (caller.getModuleIds() != null) granted.addAll(caller.getModuleIds());
        return granted;
    }

    /**
     * Does the caller hold any SafeVoice staff permission?
     *
     * Checked by prefix rather than against a fixed list, so a SafeVoice role added
     * later is picked up without a change here. Being a company administrator is
     * deliberately NOT enough on its own.
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
     * the difference between "your company has not bought this" and "you personally
     * were not given access", which are very different conversations.
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

    /**
     * Wait for one module, but never longer than {@link #MODULE_TIMEOUT}, and never
     * let its failure escape. Returns null when the module could not be read.
     */
    private ModuleSnapshot awaitQuietly(TenantModule module,
                                        CompletableFuture<ModuleSnapshot> future) {
        try {
            return future.get(MODULE_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            // Preserve the interrupt so the container can shut the thread down.
            Thread.currentThread().interrupt();
            log.warn("[dashboard] interrupted while reading module {}", module);
            return null;
        } catch (Exception ex) {
            log.warn("[dashboard] module {} could not be read: {}", module, ex.getMessage());
            return null;
        }
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
        int open = 0;
        int overdue = 0;
        for (AttentionItem item : attention) {
            open += item.count();
            if ("RISK".equals(item.tone())) overdue += item.count();
        }

        return new Headline(active, disabled, capacity, seatsRemaining, newThisMonth,
                modulesVisible, modulesEntitled, open, overdue, plan.daysRemaining());
    }

    // ── Small helpers ───────────────────────────────────────────────────────────

    /** RISK sorts above WARN, which sorts above everything else. */
    private int toneRank(String tone) {
        if ("RISK".equals(tone)) return 0;
        if ("WARN".equals(tone)) return 1;
        return 2;
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
