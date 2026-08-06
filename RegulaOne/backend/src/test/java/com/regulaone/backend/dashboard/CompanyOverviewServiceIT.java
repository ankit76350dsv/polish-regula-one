package com.regulaone.backend.dashboard;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.ModuleCard;
import com.regulaone.backend.models.AuditLog;
import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.TenantModule;
import com.regulaone.backend.models.User;
import com.regulaone.backend.user.UserRepository;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * End-to-end check of the company-admin dashboard SERVICE, against the live
 * development database.
 *
 * The reader-level test ({@code ModuleMetricsReaderIT}) proves each module's
 * queries work. This one proves the layer above them: that the company is taken
 * from the signed-in user, that the plan and per-user access gates produce the
 * right card status for each module, that the "needs attention" list is ordered
 * most-serious-first, and that the read is written to the audit trail.
 *
 * HOW TO RUN IT — skipped by default (the {@code IT} suffix keeps it out of the
 * normal surefire run, and the flag stops accidental database access):
 *
 *   ./mvnw test -Dtest=CompanyOverviewServiceIT -Dregulaone.it=true
 *
 * Optionally point it at a specific administrator:
 *
 *   -Dregulaone.it.adminEmail=someone@example.com
 *
 * NOTE: this test performs a real dashboard read, so — correctly — it appends one
 * entry to the audit trail, exactly as a real page load would. The test asserts
 * that entry exists, because an oversight read that leaves no trace would be the
 * defect.
 */
@SpringBootTest
class CompanyOverviewServiceIT {

    private static final String ENABLE_FLAG = "regulaone.it";
    private static final String ADMIN_EMAIL_PROPERTY = "regulaone.it.adminEmail";

    @Autowired
    private CompanyOverviewService companyOverviewService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    /** The administrator whose dashboard is being built. */
    private User admin() {
        Assumptions.assumeTrue(Boolean.getBoolean(ENABLE_FLAG),
                "Skipped: pass -D" + ENABLE_FLAG + "=true to run against a live database");

        String email = System.getProperty(ADMIN_EMAIL_PROPERTY);

        Optional<User> found = email != null && !email.isBlank()
                ? userRepository.findByEmail(email)
                // No e-mail given: take any company administrator that has a company.
                : userRepository.findAll().stream()
                        .filter(u -> u.getRole() == Role.ROLE_ADMIN)
                        .filter(u -> u.getTenant() != null && u.getTenant().getId() != null)
                        .findFirst();

        Assumptions.assumeTrue(found.isPresent(),
                "Skipped: no company administrator found to build a dashboard for");
        User user = found.get();
        Assumptions.assumeTrue(user.getTenant() != null && user.getTenant().getId() != null,
                "Skipped: that administrator has no organisation set up yet");
        return user;
    }

    @Test
    void buildsTheWholeDashboardForTheCallersOwnCompany() {
        User admin = admin();

        // The HTTP request is only used to stamp the audit entry's IP and user
        // agent, so null is a valid input here and must not break the read.
        CompanyOverviewResponse overview =
                companyOverviewService.build(admin.getCognitoSub(), null);

        assertNotNull(overview, "no dashboard was built");

        // ── The company is the CALLER'S company, never anything passed in ──────
        assertNotNull(overview.company(), "company block missing");
        assertEquals(admin.getTenant().getId(), overview.company().id(),
                "the dashboard answered for a different company than the caller's");

        // ── One card per module, always, in the enum's order ───────────────────
        assertEquals(TenantModule.values().length, overview.modules().size(),
                "every module must produce a card, even when it has no figures");

        List<String> expectedOrder = java.util.Arrays.stream(TenantModule.values())
                .map(TenantModule::name).toList();
        assertEquals(expectedOrder, overview.modules().stream().map(ModuleCard::module).toList(),
                "module cards came back in an unstable order");

        // ── Card status must match the access rules, per module ────────────────
        Set<String> entitled = Set.copyOf(overview.entitledModules());
        Set<String> granted = admin.getModuleIds() == null ? Set.of()
                : admin.getModuleIds().stream().map(TenantModule::name)
                        .collect(java.util.stream.Collectors.toSet());
        boolean safeVoiceAuthorised = admin.getPermissions() != null
                && admin.getPermissions().stream()
                        .anyMatch(code -> code != null && code.startsWith("SAFEVOICE_"));

        for (ModuleCard card : overview.modules()) {
            if (!entitled.contains(card.module())) {
                assertEquals("NOT_IN_PLAN", card.status(),
                        card.module() + " is outside the plan but was not reported as such");
                assertTrue(card.metrics().isEmpty(),
                        card.module() + " returned figures despite being outside the plan");
                continue;
            }
            if (!granted.contains(card.module())) {
                assertEquals("NO_ACCESS", card.status(),
                        card.module() + " was not granted to this admin but was not reported as such");
                assertTrue(card.metrics().isEmpty(),
                        card.module() + " returned figures despite not being granted");
                continue;
            }
            if ("SAFEVOICE".equals(card.module()) && !safeVoiceAuthorised) {
                // Whistleblower confidentiality: being a company admin is not enough
                // (Directive (EU) 2019/1937 Art. 16).
                assertEquals("RESTRICTED", card.status(),
                        "SafeVoice figures were exposed without a SafeVoice role");
                assertTrue(card.metrics().isEmpty(),
                        "SafeVoice returned figures without a SafeVoice role");
                continue;
            }
            // Anything left should have been read. UNAVAILABLE is tolerated — a
            // module's collections may genuinely be unreachable — but never silent.
            assertTrue(List.of("OK", "UNAVAILABLE").contains(card.status()),
                    card.module() + " has an unexpected status: " + card.status());
        }

        // ── The attention list is a to-do list: worst first ─────────────────────
        int previousRank = -1;
        for (var item : overview.attention()) {
            int rank = switch (item.tone()) {
                case "RISK" -> 0;
                case "WARN" -> 1;
                default -> 2;
            };
            assertTrue(rank >= previousRank,
                    "attention list is not ordered most-serious-first: " + item.type());
            previousRank = rank;
            assertTrue(item.count() > 0, item.type() + " was raised with a count of 0");
        }

        // ── The headline totals must agree with the attention list ─────────────
        int openFromList = overview.attention().stream().mapToInt(a -> a.count()).sum();
        int overdueFromList = overview.attention().stream()
                .filter(a -> "RISK".equals(a.tone())).mapToInt(a -> a.count()).sum();
        assertEquals(openFromList, overview.headline().openComplianceActions(),
                "headline open-actions total does not match the attention list");
        assertEquals(overdueFromList, overview.headline().overdueComplianceActions(),
                "headline overdue total does not match the RISK items");

        // ── Provenance ─────────────────────────────────────────────────────────
        assertNotNull(overview.generatedAt(), "the snapshot has no generated-at stamp");

        System.out.printf(
                "%n company=%s (%s)  plan=%s  daysLeft=%s%n users=%d active  modules=%d/%d%n"
                        + " open=%d  overdue=%d  attention=%d  activity=%d  chart=%d%n",
                overview.company().name(), overview.company().status(),
                overview.plan().packageName(), overview.plan().daysRemaining(),
                overview.headline().activeUsers(),
                overview.headline().modulesVisible(), overview.headline().modulesEntitled(),
                overview.headline().openComplianceActions(),
                overview.headline().overdueComplianceActions(),
                overview.attention().size(), overview.recentActivity().size(),
                overview.invoiceVolume().size());
        overview.attention().forEach(a ->
                System.out.printf("   ! %-12s %-42s x%-5d %s%n",
                        a.module(), a.type(), a.count(), a.tone()));
    }

    @Test
    void theDashboardReadIsRecordedInTheAuditTrail() {
        User admin = admin();

        companyOverviewService.build(admin.getCognitoSub(), null);

        // Newest audit line for this company must be the dashboard read we just did.
        AuditLog latest = mongoTemplate.findOne(
                Query.query(Criteria.where("tenantId").is(admin.getTenant().getId())
                                .and("action").is("COMPANY_OVERVIEW_VIEWED"))
                        .with(Sort.by(Sort.Direction.DESC, "timestamp"))
                        .with(PageRequest.of(0, 1)),
                AuditLog.class);

        assertNotNull(latest, "the dashboard read left no audit entry");
        assertEquals(admin.getEmail(), latest.getUserEmail(), "audit entry names the wrong actor");
        assertEquals("COMPANY_OVERVIEW", latest.getResource());
        assertTrue(latest.isSuccess());
        assertNotNull(latest.getTimestamp());

        // The SCOPE is what makes the entry useful: it records which modules the
        // person was actually shown, not merely that a page was opened.
        assertNotNull(latest.getDetails(), "audit entry does not record which modules were shown");

        System.out.println("\n audit entry: " + latest.getAction()
                + " by " + latest.getUserEmail()
                + " scope=" + latest.getDetails()
                + " at " + latest.getTimestamp());
    }
}
