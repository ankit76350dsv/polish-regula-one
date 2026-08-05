package com.regulaone.backend.repository.modules;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.Metric;
import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.MonthPoint;
import com.mongodb.ConnectionString;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Live-database check for the six module readers behind the company dashboard.
 *
 * WHY IT EXISTS: the readers query collections owned by OTHER services, in two
 * different languages, with fields whose stored types are not always what the Java
 * model suggests (a calendar day can arrive as text rather than a date). A unit
 * test cannot catch that class of mistake — only a real query can. And the mistake
 * it catches is the dangerous kind: not a crash, but a compliance number that is
 * silently zero.
 *
 * HOW TO RUN IT — it is SKIPPED by default so the normal build needs no database:
 *
 *   ./mvnw test -Dtest=ModuleMetricsReaderIT -Dregulaone.it=true
 *
 * The connection string is read from the module's own application-dev.properties,
 * so no credential is ever typed on a command line or committed to a test. Point it
 * at a different company with:
 *
 *   -Dregulaone.it.tenantId=<company id>
 *
 * WHAT IT ASSERTS: that every reader completes against real data and returns
 * well-formed facts (known units, known tones, non-negative counts). It deliberately
 * does NOT assert exact figures — those change as the company works — and it never
 * prints a document, only counts and metric keys.
 */
class ModuleMetricsReaderIT {

    /** Turn the test on. Absent means skip. */
    private static final String ENABLE_FLAG = "regulaone.it";

    /** Optional company override. */
    private static final String TENANT_PROPERTY = "regulaone.it.tenantId";

    private static final String DEV_PROPERTIES = "src/main/resources/application-dev.properties";
    private static final String URI_KEY = "spring.mongodb.uri";

    private static final List<String> ALLOWED_UNITS =
            List.of("COUNT", "PERCENT", "HOURS", "KG", "DATE", "MONEY", "TEXT");
    private static final List<String> ALLOWED_TONES =
            List.of("NEUTRAL", "GOOD", "WARN", "RISK");

    // ── Harness ─────────────────────────────────────────────────────────────────

    private MongoTemplate mongoTemplate() {
        Assumptions.assumeTrue(Boolean.getBoolean(ENABLE_FLAG),
                "Skipped: pass -D" + ENABLE_FLAG + "=true to run against a live database");

        String uri = devMongoUri();
        Assumptions.assumeTrue(uri != null && !uri.isBlank(),
                "Skipped: " + URI_KEY + " not found in " + DEV_PROPERTIES);

        // The database name comes from the connection string itself, exactly as the
        // running application resolves it.
        ConnectionString connection = new ConnectionString(uri);
        String database = connection.getDatabase() != null ? connection.getDatabase() : "RegulaOne";

        return new MongoTemplate(new SimpleMongoClientDatabaseFactory(connection.toString()), null) {
            @Override
            public String toString() {
                return "MongoTemplate[" + database + "]";
            }
        };
    }

    /** Read the dev connection string from the properties file the app itself uses. */
    private String devMongoUri() {
        Path path = Path.of(DEV_PROPERTIES);
        if (!Files.exists(path)) return null;
        Properties properties = new Properties();
        try (InputStream in = Files.newInputStream(path)) {
            properties.load(in);
        } catch (IOException ex) {
            return null;
        }
        return properties.getProperty(URI_KEY);
    }

    private String tenantId() {
        String tenantId = System.getProperty(TENANT_PROPERTY, "6a34ca2d9d71d550dff0c3b6");
        Assumptions.assumeTrue(!tenantId.isBlank(), "Skipped: no company id to test with");
        return tenantId;
    }

    /**
     * Every metric must be well formed: a key, a value, a unit and a tone the
     * frontend knows how to render. A typo in a unit or tone would show up as an
     * unstyled or blank tile, which is exactly the kind of defect that survives
     * code review.
     */
    private void assertWellFormed(String module, ModuleSnapshot snapshot) {
        assertNotNull(snapshot, module + ": reader returned nothing");
        assertNotNull(snapshot.metrics(), module + ": metrics list is null");
        assertNotNull(snapshot.attention(), module + ": attention list is null");

        for (Metric metric : snapshot.metrics()) {
            assertNotNull(metric.key(), module + ": a metric has no key");
            assertNotNull(metric.value(), module + ": metric " + metric.key() + " has no value");
            assertTrue(ALLOWED_UNITS.contains(metric.unit()),
                    module + ": metric " + metric.key() + " has unknown unit " + metric.unit());
            assertTrue(ALLOWED_TONES.contains(metric.tone()),
                    module + ": metric " + metric.key() + " has unknown tone " + metric.tone());

            // A count must never come back negative — that would mean a subtraction
            // somewhere produced nonsense.
            if ("COUNT".equals(metric.unit())) {
                assertTrue(Long.parseLong(metric.value()) >= 0,
                        module + ": metric " + metric.key() + " is negative");
            }
        }

        for (AttentionItem item : snapshot.attention()) {
            assertNotNull(item.module(), module + ": attention item has no module");
            assertNotNull(item.type(), module + ": attention item has no type");
            assertTrue(item.count() > 0,
                    module + ": attention item " + item.type() + " was raised with a count of 0");
            assertTrue(ALLOWED_TONES.contains(item.tone()),
                    module + ": attention item " + item.type() + " has unknown tone " + item.tone());
            assertNotNull(item.to(), module + ": attention item " + item.type() + " has no link");
        }

        // Printed so a developer running this can eyeball the real figures.
        System.out.println("\n── " + module + " ──");
        snapshot.metrics().forEach(m ->
                System.out.printf("   %-52s %-10s %-8s %s%n",
                        m.key(), m.value(), m.unit(), m.tone()));
        snapshot.attention().forEach(a ->
                System.out.printf("   ! %-46s x%-6d %s%n", a.type(), a.count(), a.tone()));
    }

    // ── The six modules ─────────────────────────────────────────────────────────

    @Test
    void ksefFlowReaderReturnsWellFormedFigures() {
        MongoTemplate mongo = mongoTemplate();
        KsefFlowMetricsReader reader = new KsefFlowMetricsReader(mongo);

        assertWellFormed("KSEFFLOW", reader.read(tenantId()));

        // The trend chart must always hand back the full window, zero-filled, so the
        // chart has no gaps and its x-axis is stable between loads.
        List<MonthPoint> volume = reader.invoiceVolume(tenantId(), 12);
        assertTrue(volume.size() == 12, "expected 12 chart buckets, got " + volume.size());
        for (MonthPoint point : volume) {
            assertTrue(point.month().matches("\\d{4}-\\d{2}"),
                    "chart bucket is not YYYY-MM: " + point.month());
            assertTrue(point.count() >= 0, "negative invoice count in " + point.month());
        }
        System.out.println("   invoiceVolume: " + volume);
    }

    @Test
    void workPulseReaderReturnsWellFormedFigures() {
        assertWellFormed("WORKPULSE",
                new WorkPulseMetricsReader(mongoTemplate()).read(tenantId()));
    }

    @Test
    void safeWorkReaderReturnsWellFormedFigures() {
        assertWellFormed("SAFEWORK",
                new SafeWorkMetricsReader(mongoTemplate()).read(tenantId()));
    }

    @Test
    void safeVoiceReaderReturnsWellFormedFigures() {
        ModuleSnapshot snapshot = new SafeVoiceMetricsReader(mongoTemplate()).read(tenantId());
        assertWellFormed("SAFEVOICE", snapshot);

        // Confidentiality guard: nothing that could identify a reporter or a case may
        // ever appear in a SafeVoice metric key. If someone later adds a breakdown by
        // category or department, this test fails on purpose.
        List<String> forbidden = List.of("category", "department", "severity",
                "reference", "reporter", "investigator", "disclosure", "description");
        for (Metric metric : snapshot.metrics()) {
            String key = metric.key().toLowerCase();
            for (String word : forbidden) {
                assertTrue(!key.contains(word),
                        "SafeVoice metric '" + metric.key() + "' exposes '" + word
                                + "'. Whistleblower figures must stay non-identifying "
                                + "(Directive (EU) 2019/1937 Art. 16).");
            }
        }
    }

    @Test
    void wasteSyncReaderReturnsWellFormedFigures() {
        assertWellFormed("WASTESYNC",
                new WasteSyncMetricsReader(mongoTemplate()).read(tenantId()));
    }

    @Test
    void privacyPilotReaderReturnsWellFormedFigures() {
        assertWellFormed("PRIVACYPILOT",
                new PrivacyPilotMetricsReader(mongoTemplate()).read(tenantId()));
    }

    // ── The shared activity feed ─────────────────────────────────────────────────

    @Test
    void activityFeedMergesModulesAndNeverIncludesSafeVoice() {
        MongoTemplate mongo = mongoTemplate();

        // Ask for every module — including SafeVoice, to prove the reader refuses it
        // rather than relying on the caller to leave it out.
        var visible = new java.util.LinkedHashSet<>(List.of(
                "KSEFFLOW", "WORKPULSE", "SAFEWORK", "WASTESYNC", "PRIVACYPILOT", "SAFEVOICE"));

        var entries = new ArrayList<>(new ActivityFeedReader(mongo)
                .read(tenantId(), visible, 6, 12));

        assertTrue(entries.size() <= 12, "feed exceeded its limit: " + entries.size());

        for (var entry : entries) {
            assertTrue(!"SAFEVOICE".equals(entry.module()),
                    "SafeVoice audit lines must never reach the shared activity feed "
                            + "(Directive (EU) 2019/1937 Art. 16).");
            assertNotNull(entry.module());
            assertNotNull(entry.action());
        }

        // Newest first — the whole point of the feed.
        for (int i = 1; i < entries.size(); i++) {
            var earlier = entries.get(i).at();
            var later = entries.get(i - 1).at();
            if (earlier != null && later != null) {
                assertTrue(!later.isBefore(earlier), "activity feed is not newest-first");
            }
        }

        System.out.println("\n── ACTIVITY FEED ──");
        entries.forEach(e -> System.out.printf("   %-14s %-26s %-20s %s%n",
                e.module(), e.action(), e.resource(), e.at()));
    }
}
