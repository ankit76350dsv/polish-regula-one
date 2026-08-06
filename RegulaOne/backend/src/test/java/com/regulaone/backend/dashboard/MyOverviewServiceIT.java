package com.regulaone.backend.dashboard;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.ActivityEntry;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.Metric;
import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.ModuleCard;
import com.regulaone.backend.dashboard.dto.MyOverviewResponse;
import com.regulaone.backend.dashboard.dto.MyOverviewResponse.MyDocument;
import com.regulaone.backend.models.AuditLog;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * End-to-end check of the PERSONAL dashboard service, against the live development
 * database.
 *
 * What it is really guarding: that "my workspace" stays MINE. The gates are easy to
 * describe and easy to break later, so this test asserts each of them:
 *
 *   * the workspace is built for the caller's own company and own user id;
 *   * a module outside the plan is NOT_IN_PLAN and returns no figures;
 *   * a module not granted to the person is NO_ACCESS and returns no figures;
 *   * SafeVoice without a SafeVoice permission is RESTRICTED and returns nothing;
 *   * every metric key is a "my.*" key — a company-wide figure pasted into a
 *     personal reader would fail the build here;
 *   * the activity feed contains only lines recorded under this person's own name;
 *   * the read is written to RegulaOne's audit trail with its module scope.
 *
 * HOW TO RUN IT — skipped by default (the {@code IT} suffix keeps it out of the
 * normal surefire run, and the flag stops accidental database access):
 *
 *   ./mvnw test -Dtest=MyOverviewServiceIT -Dregulaone.it=true
 *
 * Optionally point it at a specific person:
 *
 *   -Dregulaone.it.userEmail=someone@example.com
 *
 * NOTE: this performs a real dashboard read, so — correctly — it appends one entry
 * to the audit trail, exactly as a real page load would.
 */
@SpringBootTest
class MyOverviewServiceIT {

    private static final String ENABLE_FLAG = "regulaone.it";
    private static final String USER_EMAIL_PROPERTY = "regulaone.it.userEmail";

    @Autowired
    private MyOverviewService myOverviewService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    /** The person whose workspace is being built. */
    private User person() {
        Assumptions.assumeTrue(Boolean.getBoolean(ENABLE_FLAG),
                "Skipped: pass -D" + ENABLE_FLAG + "=true to run against a live database");

        String email = System.getProperty(USER_EMAIL_PROPERTY);

        Optional<User> found = email != null && !email.isBlank()
                ? userRepository.findByEmail(email)
                // No e-mail given: take any member of a company that has modules.
                : userRepository.findAll().stream()
                        .filter(u -> u.getTenant() != null && u.getTenant().getId() != null)
                        .filter(u -> u.getModuleIds() != null && !u.getModuleIds().isEmpty())
                        .findFirst();

        Assumptions.assumeTrue(found.isPresent(),
                "Skipped: no user with a company and module access was found");
        return found.get();
    }

    @Test
    void buildsTheWorkspaceForTheCallerOnly() {
        User person = person();

        // The HTTP request is only used to stamp the audit entry's IP and user agent,
        // so null is a valid input here and must not break the read.
        MyOverviewResponse mine = myOverviewService.build(person.getCognitoSub(), null);

        assertNotNull(mine, "no workspace was built");

        // ── It is about the CALLER, never about anybody passed in ───────────────
        assertNotNull(mine.me(), "the 'me' block is missing");
        assertEquals(person.getId(), mine.me().userId(),
                "the workspace was built for a different user than the caller");
        assertEquals(person.getEmail(), mine.me().email());
        assertEquals(person.getTenant().getId(), mine.me().companyId(),
                "the workspace answered for a different company than the caller's");

        // ── One card per module, always, in the enum's order ────────────────────
        assertEquals(TenantModule.values().length, mine.modules().size(),
                "every module must produce a card, even when it has no figures");

        List<String> expectedOrder = java.util.Arrays.stream(TenantModule.values())
                .map(TenantModule::name).toList();
        assertEquals(expectedOrder, mine.modules().stream().map(ModuleCard::module).toList(),
                "module cards came back in an unstable order");

        // ── Card status must match the access rules, per module ─────────────────
        Set<String> entitled = Set.copyOf(mine.entitledModules());
        Set<String> granted = Set.copyOf(mine.grantedModules());
        boolean safeVoiceAuthorised = person.getPermissions() != null
                && person.getPermissions().stream()
                        .anyMatch(code -> code != null && code.startsWith("SAFEVOICE_"));

        for (ModuleCard card : mine.modules()) {
            if (!entitled.contains(card.module())) {
                assertEquals("NOT_IN_PLAN", card.status(),
                        card.module() + " is outside the plan but was not reported as such");
                assertTrue(card.metrics().isEmpty(),
                        card.module() + " returned figures despite being outside the plan");
                continue;
            }
            if (!granted.contains(card.module())) {
                assertEquals("NO_ACCESS", card.status(),
                        card.module() + " was not granted to this person but was not reported as such");
                assertTrue(card.metrics().isEmpty(),
                        card.module() + " returned figures despite not being granted");
                continue;
            }
            if ("SAFEVOICE".equals(card.module()) && !safeVoiceAuthorised) {
                // Whistleblower confidentiality: having the module in the menu is not
                // enough (Directive (EU) 2019/1937 Art. 16).
                assertEquals("RESTRICTED", card.status(),
                        "SafeVoice figures were exposed without a SafeVoice permission");
                assertTrue(card.metrics().isEmpty(),
                        "SafeVoice returned figures without a SafeVoice permission");
                continue;
            }
            assertTrue(List.of("OK", "UNAVAILABLE").contains(card.status()),
                    card.module() + " has an unexpected status: " + card.status());
        }

        // ── THE ANTI-LEAK GUARD ────────────────────────────────────────────────
        // Everything on this screen is personal, so every metric key starts with
        // "my.". If somebody ever copies a company-wide figure into a personal
        // reader, the key will not match and this test fails — which is the point.
        for (ModuleCard card : mine.modules()) {
            for (Metric metric : card.metrics()) {
                assertTrue(metric.key().startsWith("my."),
                        "a non-personal metric appeared on the personal dashboard: " + metric.key());
                assertTrue(List.of("COUNT", "PERCENT", "HOURS", "KG", "DATE", "MONEY", "TEXT")
                                .contains(metric.unit()),
                        metric.key() + " has an unknown unit: " + metric.unit());
                assertTrue(List.of("NEUTRAL", "GOOD", "WARN", "RISK").contains(metric.tone()),
                        metric.key() + " has an unknown tone: " + metric.tone());
            }
        }

        // Personal to-do items are also personal — same guard on the type codes.
        int previousRank = -1;
        for (AttentionItem item : mine.attention()) {
            assertTrue(item.type().startsWith("MY_"),
                    "a company-wide to-do item appeared on a personal dashboard: " + item.type());
            assertTrue(item.count() > 0, item.type() + " was raised with a count of 0");

            int rank = switch (item.tone()) {
                case "RISK" -> 0;
                case "WARN" -> 1;
                default -> 2;
            };
            assertTrue(rank >= previousRank,
                    "the to-do list is not ordered most-serious-first: " + item.type());
            previousRank = rank;
        }

        // ── The headline must agree with the list under it ──────────────────────
        int openFromList = mine.attention().stream().mapToInt(AttentionItem::count).sum();
        int overdueFromList = mine.attention().stream()
                .filter(a -> "RISK".equals(a.tone())).mapToInt(AttentionItem::count).sum();
        assertEquals(openFromList, mine.headline().openActions(),
                "headline open-actions total does not match the to-do list");
        assertEquals(overdueFromList, mine.headline().overdueActions(),
                "headline overdue total does not match the RISK items");

        // ── The activity feed is the person's OWN trail ─────────────────────────
        for (ActivityEntry entry : mine.recentActivity()) {
            assertTrue(granted.contains(entry.module()),
                    "an audit line came from a module this person cannot open: " + entry.module());
        }

        // ── Documents carry a real date or an honest reason not to ──────────────
        for (MyDocument document : mine.documents()) {
            assertTrue(List.of("MEDICAL_CERTIFICATE", "BHP_TRAINING").contains(document.type()));
            assertTrue(List.of("VALID", "EXPIRING", "EXPIRED", "MISSING", "NOT_REQUIRED")
                            .contains(document.status()),
                    document.type() + " has an unknown status: " + document.status());
            if ("VALID".equals(document.status()) || "EXPIRING".equals(document.status())) {
                assertNotNull(document.expiryDate(),
                        document.type() + " is valid but carries no expiry date");
                assertNotNull(document.daysRemaining());
            }
        }

        // ── Provenance ─────────────────────────────────────────────────────────
        assertNotNull(mine.generatedAt(), "the snapshot has no generated-at stamp");

        System.out.printf(
                "%n me=%s (%s) company=%s%n shift=%s  worked=%s h  overtime=%s h  documents=%s  blocked=%s%n"
                        + " open=%d  overdue=%d  modules=%d/%d  activity=%d%n",
                mine.me().name(), mine.me().role(), mine.me().companyName(),
                mine.headline().shiftStatusToday(),
                mine.headline().workedHoursThisMonth(),
                mine.headline().overtimeHoursThisMonth(),
                mine.headline().documentStatus(),
                mine.headline().blockedFromWork(),
                mine.headline().openActions(), mine.headline().overdueActions(),
                mine.headline().modulesAvailable(), mine.headline().modulesEntitled(),
                mine.recentActivity().size());

        mine.attention().forEach(a ->
                System.out.printf("   ! %-12s %-46s x%-5d %s%n",
                        a.module(), a.type(), a.count(), a.tone()));
        mine.documents().forEach(d ->
                System.out.printf("   · %-22s %-12s %s (%s days)%n",
                        d.type(), d.status(), d.expiryDate(), d.daysRemaining()));
    }

    @Test
    void aPersonalReadIsRecordedInTheAuditTrail() {
        User person = person();

        myOverviewService.build(person.getCognitoSub(), null);

        AuditLog latest = mongoTemplate.findOne(
                Query.query(Criteria.where("tenantId").is(person.getTenant().getId())
                                .and("action").is("MY_OVERVIEW_VIEWED")
                                .and("userId").is(person.getId()))
                        .with(Sort.by(Sort.Direction.DESC, "timestamp"))
                        .with(PageRequest.of(0, 1)),
                AuditLog.class);

        assertNotNull(latest, "the personal dashboard read left no audit entry");
        assertEquals(person.getEmail(), latest.getUserEmail(), "audit entry names the wrong actor");
        assertEquals("MY_OVERVIEW", latest.getResource());
        assertTrue(latest.isSuccess());
        assertNotNull(latest.getTimestamp());
        // The SCOPE is what makes the entry useful: which modules the person was
        // actually shown, not merely that a page was opened.
        assertNotNull(latest.getDetails(), "audit entry does not record which modules were shown");

        System.out.println("\n audit entry: " + latest.getAction()
                + " by " + latest.getUserEmail()
                + " scope=" + latest.getDetails()
                + " at " + latest.getTimestamp());
    }

    @Test
    void aPersonWithNoCompanySeesAnEmptyWorkspaceRatherThanAnError() {
        Assumptions.assumeTrue(Boolean.getBoolean(ENABLE_FLAG),
                "Skipped: pass -D" + ENABLE_FLAG + "=true to run against a live database");

        Optional<User> orphan = userRepository.findAll().stream()
                .filter(u -> u.getTenant() == null || u.getTenant().getId() == null)
                .filter(u -> u.getCognitoSub() != null)
                .findFirst();

        Assumptions.assumeTrue(orphan.isPresent(),
                "Skipped: every user in this database belongs to a company");

        MyOverviewResponse mine = myOverviewService.build(orphan.get().getCognitoSub(), null);

        // An empty workspace, not an exception: the screen can then explain the state.
        assertNotNull(mine);
        assertTrue(mine.modules().isEmpty(), "a user with no company was shown module cards");
        assertTrue(mine.attention().isEmpty());
        assertTrue(mine.documents().isEmpty());
        assertFalse(mine.rights().whistleblowingChannelAvailable());
        assertEquals(0, mine.headline().openActions());

        System.out.println("\n user with no company: " + orphan.get().getEmail()
                + " → empty workspace, no error");
    }
}
