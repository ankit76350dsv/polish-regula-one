package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.audit.AuditEntryResponse;
import com.privacypilot.backend.dto.dashboard.DashboardResponse;
import com.privacypilot.backend.dto.dashboard.DashboardResponse.AttentionItem;
import com.privacypilot.backend.dto.dashboard.DashboardResponse.Counts;
import com.privacypilot.backend.dto.dashboard.DashboardResponse.GroupCount;
import com.privacypilot.backend.model.document.Breach;
import com.privacypilot.backend.model.document.Dpia;
import com.privacypilot.backend.model.document.Dsar;
import com.privacypilot.backend.model.document.ProcessingActivity;
import com.privacypilot.backend.model.document.Vendor;
import com.privacypilot.backend.model.enums.breach.BreachStatus;
import com.privacypilot.backend.model.enums.dpia.DpiaStatus;
import com.privacypilot.backend.model.enums.dpia.DpiaVerdict;
import com.privacypilot.backend.model.enums.dsar.DsarStatus;
import com.privacypilot.backend.model.enums.vendor.DpaStatus;
import com.privacypilot.backend.repository.AuditEntryRepository;
import com.privacypilot.backend.repository.BreachRepository;
import com.privacypilot.backend.repository.DpiaRepository;
import com.privacypilot.backend.repository.DsarRepository;
import com.privacypilot.backend.repository.ProcessingActivityRepository;
import com.privacypilot.backend.repository.VendorRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds the compliance dashboard summary for the caller's company.
 *
 * It reads the live registers (activities, DPIAs, breaches, DSARs, vendors, audit),
 * counts what matters, works out the legal clocks ONCE on the server, and returns a
 * small summary. All reads are scoped to the caller's tenant, so one company can never
 * see another's numbers.
 *
 * The numbers are plain facts — counts and deadlines — never an invented score.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    // A breach must be reported to UODO without undue delay and within 72 hours of
    // becoming aware of it (Art. 33(1) GDPR).
    private static final Duration UODO_WINDOW = Duration.ofHours(72);

    // A DSAR is "urgent" for the dashboard when it is due within a working week.
    private static final int DSAR_URGENT_DAYS = 7;

    // How many recent audit lines the dashboard shows.
    private static final int RECENT_AUDIT_LIMIT = 6;

    private static final long DAY_MS = 24L * 60 * 60 * 1000;

    private final ProcessingActivityRepository activityRepo;
    private final DpiaRepository dpiaRepo;
    private final BreachRepository breachRepo;
    private final DsarRepository dsarRepo;
    private final VendorRepository vendorRepo;
    private final AuditEntryRepository auditRepo;

    /** Assemble the whole dashboard for the caller's company. */
    public DashboardResponse build(AuthenticatedUser caller) {
        String tenantId = caller.tenantId();
        Instant now = Instant.now();

        // Pull every live (non-deleted) list for this tenant, once.
        List<ProcessingActivity> activities =
                activityRepo.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(tenantId);
        List<Dpia> dpias = dpiaRepo.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(tenantId);
        List<Breach> breaches = breachRepo.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(tenantId);
        List<Dsar> dsars = dsarRepo.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(tenantId);
        List<Vendor> vendors = vendorRepo.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(tenantId);

        // ── ROPA: the register has no "archived" status; a live activity is simply one
        //    that is not soft-deleted, which the repository already filtered for us.
        int ropaActive = activities.size();

        // ── DPIA: how many are being worked on, and how many activities were screened as
        //    "DPIA required" but still have no DPIA started (the real backlog, Art. 35(1)).
        int dpiaInProgress = (int) dpias.stream()
                .filter(d -> d.getStatus() == DpiaStatus.IN_PROGRESS).count();
        List<ProcessingActivity> needDpia = activities.stream()
                .filter(a -> a.getDpiaVerdict() == DpiaVerdict.REQUIRED && a.getDpiaId() == null)
                .toList();

        // ── Breaches: open ones, and the subset still inside the 72h UODO window and not
        //    yet notified (the ones a clock is actively ticking on, Art. 33).
        List<Breach> openBreaches = breaches.stream()
                .filter(b -> b.getStatus() == BreachStatus.OPEN).toList();
        List<Breach> ticking72h = openBreaches.stream()
                .filter(b -> breachTicking(b, now)).toList();

        // ── DSARs: still being handled means IN_PROGRESS (completed AND refused are both
        //    closed). Urgent = due within a week (negative days = already overdue).
        List<Dsar> openDsars = dsars.stream()
                .filter(d -> d.getStatus() == DsarStatus.IN_PROGRESS).toList();
        List<Dsar> urgentDsars = openDsars.stream()
                .filter(d -> d.getDueAt() != null && daysLeft(d.getDueAt(), now) <= DSAR_URGENT_DAYS)
                .toList();

        Counts counts = new Counts(
                ropaActive,
                dpiaInProgress,
                needDpia.size(),
                openBreaches.size(),
                ticking72h.size(),
                openDsars.size(),
                urgentDsars.size());

        // ── Charts: group the live register by department and by lawful basis. Skip
        //    activities that have not filled the field in yet (null), and show the
        //    biggest bars first.
        List<GroupCount> byDepartment = group(activities,
                a -> a.getDepartment() == null ? null : a.getDepartment().name());
        List<GroupCount> byBasis = group(activities,
                a -> a.getLawfulBasis() == null ? null : a.getLawfulBasis().name());

        // ── Attention list: only real deadlines / gaps, each with a deep link. Order
        //    from most to least urgent kind.
        List<AttentionItem> attention = new ArrayList<>();
        for (Breach b : ticking72h) {
            attention.add(new AttentionItem("BREACH_72H", b.getId(),
                    "/breaches/" + b.getId(), b.getTitle(), "RISK", null));
        }
        for (Dsar d : urgentDsars) {
            int left = daysLeft(d.getDueAt(), now);
            attention.add(new AttentionItem("DSAR_URGENT", d.getId(),
                    "/dsar/" + d.getId(), d.getRequesterName(), left < 0 ? "RISK" : "WARN", left));
        }
        for (ProcessingActivity a : needDpia) {
            attention.add(new AttentionItem("DPIA_REQUIRED", a.getId(),
                    "/register/" + a.getId(), a.getName(), "WARN", null));
        }
        for (Dpia d : dpias) {
            if (d.isPriorConsultation() && d.getStatus() != DpiaStatus.APPROVED) {
                attention.add(new AttentionItem("PRIOR_CONSULTATION", d.getId(),
                        "/dpia/" + d.getId(), d.getTitle(), "RISK", null));
            }
        }
        for (Vendor v : vendors) {
            if (v.getDpaStatus() == DpaStatus.MISSING) {
                attention.add(new AttentionItem("VENDOR_DPA_MISSING", v.getId(),
                        "/vendors", v.getName(), "WARN", null));
            }
        }

        // ── Recent audit: newest few lines, mapped to the same read-only shape the
        //    audit screen already uses.
        List<AuditEntryResponse> recentAudit =
                auditRepo.findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(tenantId).stream()
                        .limit(RECENT_AUDIT_LIMIT)
                        .map(AuditEntryResponse::from)
                        .toList();

        return new DashboardResponse(counts, byDepartment, byBasis, attention, recentAudit);
    }

    // A breach's 72h clock is still ticking when: it must be reported to UODO, it has
    // NOT been reported yet, and the 72 hours from discovery have not run out.
    private boolean breachTicking(Breach b, Instant now) {
        if (!b.isUodoNotificationRequired()) return false;
        if (b.getUodoNotifiedAt() != null) return false;
        if (b.getDiscoveredAt() == null) return false;
        return now.isBefore(b.getDiscoveredAt().plus(UODO_WINDOW));
    }

    // Whole days from now until a deadline, rounded UP (so any part-day still counts as a
    // day left). Matches the browser's old ceil-based maths. Negative = past the deadline.
    private int daysLeft(Instant dueAt, Instant now) {
        long diffMs = dueAt.toEpochMilli() - now.toEpochMilli();
        return (int) Math.ceil(diffMs / (double) DAY_MS);
    }

    // Count how many activities fall in each category (skipping blanks), biggest first.
    private List<GroupCount> group(List<ProcessingActivity> activities,
                                   java.util.function.Function<ProcessingActivity, String> keyOf) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (ProcessingActivity a : activities) {
            String key = keyOf.apply(a);
            if (key == null) continue;
            counts.merge(key, 1, Integer::sum);
        }
        return counts.entrySet().stream()
                .sorted(Comparator.<Map.Entry<String, Integer>>comparingInt(Map.Entry::getValue).reversed()
                        .thenComparing(Map.Entry::getKey))
                .map(e -> new GroupCount(e.getKey(), e.getValue()))
                .toList();
    }
}
