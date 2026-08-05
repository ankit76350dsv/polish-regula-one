package com.regulaone.backend.repository.modules;

import com.regulaone.backend.dto.Dashboard.CompanyOverviewResponse.ActivityEntry;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * Builds the "recent activity" feed shown at the bottom of the company dashboard.
 *
 * WHAT IT IS FOR: GDPR Art. 5(2) makes the company accountable for what happens to
 * personal data, and Polish law expects compliance actions to be traceable. Each
 * module already keeps its own immutable audit trail. This reader takes the newest
 * few lines from each of those trails and merges them into one timeline, so an
 * administrator can see at a glance that the modules are being used and by whom.
 *
 * WHAT IS COPIED FROM AN AUDIT RECORD — AND WHAT IS NOT:
 *   Copied:     who acted, which action, which kind of record, when, and whether
 *               it succeeded.
 *   NOT copied: the {@code oldValue} / {@code newValue} payloads. Those hold the
 *               actual changed data, which in these modules can include medical
 *               expiry dates, absence reasons, waste figures or case details. An
 *               overview screen does not need them, so they are never read
 *               (GDPR Art. 5(1)(c) — data minimisation). The full before/after
 *               values stay available inside each module's own audit screen, where
 *               the module's role checks apply.
 *
 * SAFEVOICE IS EXCLUDED ON PURPOSE:
 *   {@code safevoice_audit_logs} records who opened, triaged or messaged which
 *   whistleblower case. Showing that on a general admin dashboard would defeat the
 *   confidentiality the law requires (dyrektywa (UE) 2019/1937 art. 16; ustawa o
 *   ochronie sygnalistów). SafeVoice reports its own progress as plain counts on
 *   its card instead — see {@link SafeVoiceMetricsReader}.
 */
@Repository
public class ActivityFeedReader extends ModuleMetricsSupport {

    /**
     * One module's audit collection and the field names it uses.
     *
     * The six modules were built by different teams in two languages, so their
     * audit records do not share one field naming scheme. Rather than force a risky
     * migration on live audit data (which must stay immutable), the differences are
     * declared here and normalised on read.
     */
    private record AuditSource(
            String module,
            String collection,
            String timeField,
            String actorField,
            String actionField,
            String resourceField,
            String successField) {
    }

    private static final List<AuditSource> SOURCES = List.of(
            // KSeFFlow (Java) — stamps its own "timestamp" and has no success flag;
            // a written KSeF audit line always represents a completed action.
            new AuditSource("KSEFFLOW", "ksef_audit_logs",
                    "timestamp", "userEmail", "action", "targetEntityType", null),

            // PrivacyPilot (Java) — Spring auditing fills createdAt/createdBy.
            new AuditSource("PRIVACYPILOT", "privacypilot_audit_log",
                    "createdAt", "actorName", "action", "entityType", null),

            // WorkPulse (Node) — Mongoose timestamps plus an explicit success flag.
            new AuditSource("WORKPULSE", "workplus_auditlogs",
                    "createdAt", "userEmail", "action", "resource", "success"),

            // SafeWork (Node) — its model does not name a collection, so Mongoose
            // uses the pluralised default "auditlogs".
            new AuditSource("SAFEWORK", "auditlogs",
                    "createdAt", "userEmail", "action", "resource", "success"),

            // WasteSync (Node) — keeps a dedicated, hyphenated collection name.
            new AuditSource("WASTESYNC", "WasteSync-auditlogs",
                    "createdAt", "userEmail", "action", "resource", "success"));

    public ActivityFeedReader(MongoTemplate mongo) {
        super(mongo);
    }

    /**
     * Newest audit lines across the modules the caller may see, newest first.
     *
     * @param tenantId        the company to read (never taken from the client)
     * @param visibleModules  module codes this administrator is allowed to see; a
     *                        module the admin has no access to contributes nothing
     * @param perModuleLimit  how many lines to take from each module
     * @param totalLimit      how many lines to return after merging
     */
    public List<ActivityEntry> read(String tenantId,
                                    Set<String> visibleModules,
                                    int perModuleLimit,
                                    int totalLimit) {

        List<ActivityEntry> merged = new ArrayList<>();

        for (AuditSource source : SOURCES) {
            // Least privilege: skip any module this administrator cannot open.
            if (!visibleModules.contains(source.module())) continue;

            try {
                merged.addAll(readSource(tenantId, source, perModuleLimit));
            } catch (RuntimeException ex) {
                // One unreadable audit collection (e.g. a module never deployed in
                // this environment) must not blank the whole timeline.
                continue;
            }
        }

        // Sort newest first, then cut to the size the screen shows. Entries with no
        // timestamp sort last rather than breaking the comparison.
        merged.sort(Comparator.comparing(
                ActivityEntry::at,
                Comparator.nullsLast(Comparator.reverseOrder())));

        return merged.size() > totalLimit ? merged.subList(0, totalLimit) : merged;
    }

    /**
     * Read one module's newest audit lines.
     *
     * The projection lists the wanted fields explicitly, so the change payloads
     * ({@code oldValue} / {@code newValue}) are never transferred out of MongoDB.
     */
    private List<ActivityEntry> readSource(String tenantId, AuditSource source, int limit) {
        Document projection = new Document(source.timeField(), 1)
                .append(source.actorField(), 1)
                .append(source.actionField(), 1);
        if (source.resourceField() != null) projection.append(source.resourceField(), 1);
        if (source.successField() != null) projection.append(source.successField(), 1);

        List<Document> pipeline = List.of(
                new Document("$match", new Document("tenantId", tenantId)),
                new Document("$sort", new Document(source.timeField(), -1)),
                new Document("$limit", limit),
                new Document("$project", projection));

        List<ActivityEntry> entries = new ArrayList<>();
        for (Document row : aggregate(source.collection(), pipeline)) {
            Instant at = instant(row.get(source.timeField()));

            Object actorValue = row.get(source.actorField());
            String actor = actorValue == null ? "SYSTEM" : String.valueOf(actorValue);

            Object actionValue = row.get(source.actionField());
            String action = actionValue == null ? "UNKNOWN" : String.valueOf(actionValue);

            String resource = source.resourceField() == null
                    ? null
                    : (row.get(source.resourceField()) == null
                            ? null
                            : String.valueOf(row.get(source.resourceField())));

            // No success flag means the module only writes a line once the action
            // has completed, so treat the entry as a success.
            boolean success = source.successField() == null
                    || !Boolean.FALSE.equals(row.get(source.successField()));

            entries.add(new ActivityEntry(source.module(), actor, action, resource, at, success));
        }
        return entries;
    }
}
