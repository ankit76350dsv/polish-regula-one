package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.model.enums.audit.AuditAction;
import com.privacypilot.backend.model.enums.audit.AuditEntityType;
import org.bson.BsonRegularExpression;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Proves the audit search asks the DATABASE to do the work.
 *
 * The bug being guarded against: the old code fetched every audit line a company had ever
 * written and then filtered, sorted and trimmed the list in Java. The trail is append-only
 * and kept ten years, so that was guaranteed to break (MongoDB will not sort more than
 * 32 MB in memory, and a single request could pull hundreds of MB into the server).
 *
 * These tests capture the query object that goes to MongoDB and check that the filters, the
 * newest-first order AND the row limit are all in it. No Spring context, no database.
 */
class AuditEntryRepositoryImplTest {

    private static final String TENANT = "tenant-1";

    private MongoTemplate template;
    private AuditEntryRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        template = mock(MongoTemplate.class);
        repository = new AuditEntryRepositoryImpl(template);
        when(template.find(any(Query.class), eq(AuditEntry.class))).thenReturn(List.of());
    }

    /** Run a search with no optional filters, and hand back the query MongoDB received. */
    private Query capture() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template).find(captor.capture(), eq(AuditEntry.class));
        return captor.getValue();
    }

    private Query searchAndCapture(AuditEntityType type, String entityId, AuditAction action,
                                   String text, Instant from, Instant to, int limit) {
        repository.search(TENANT, type, entityId, action, text, from, to, limit);
        return capture();
    }

    @Test
    @DisplayName("always scopes to the caller's company")
    void alwaysScopesToTenant() {
        Document q = searchAndCapture(null, null, null, null, null, null, 100).getQueryObject();
        assertEquals(TENANT, q.get("tenantId"));
        assertEquals(false, q.get("deleted"));
    }

    @Test
    @DisplayName("the row limit is part of the query, so the database stops early")
    void limitIsPushedToTheDatabase() {
        Query query = searchAndCapture(null, null, null, null, null, null, 250);
        assertEquals(250, query.getLimit());
    }

    @Test
    @DisplayName("newest-first ordering is part of the query, so no in-memory sort is needed")
    void sortIsPushedToTheDatabase() {
        Query query = searchAndCapture(null, null, null, null, null, null, 100);
        // -1 == descending on the entry's own write time, which IS the time of the action.
        assertEquals(-1, query.getSortObject().get("createdAt"));
    }

    @Test
    @DisplayName("refuses a non-positive limit rather than quietly loading everything")
    void refusesUnboundedRead() {
        assertThrows(IllegalArgumentException.class,
                () -> repository.search(TENANT, null, null, null, null, null, null, 0));
        assertThrows(IllegalArgumentException.class,
                () -> repository.search(TENANT, null, null, null, null, null, null, -5));
    }

    @Test
    @DisplayName("filters by one record's history when an entity id is given")
    void filtersByEntityId() {
        Document q = searchAndCapture(null, "act-7", null, null, null, null, 100).getQueryObject();
        assertEquals("act-7", q.get("entityId"));
    }

    @Test
    @DisplayName("an entity id wins over an entity type — the narrower question")
    void entityIdTakesPrecedenceOverType() {
        Document q = searchAndCapture(AuditEntityType.ACTIVITY, "act-7", null, null, null, null, 100)
                .getQueryObject();
        assertEquals("act-7", q.get("entityId"));
        assertFalse(q.containsKey("entityType"), "entityType should not narrow further");
    }

    @Test
    @DisplayName("filters by entity type and by action in the database")
    void filtersByTypeAndAction() {
        Document q = searchAndCapture(AuditEntityType.DSAR, null, AuditAction.EXPORT, null,
                null, null, 100).getQueryObject();
        assertEquals(AuditEntityType.DSAR, q.get("entityType"));
        assertEquals(AuditAction.EXPORT, q.get("action"));
    }

    @Test
    @DisplayName("a date range becomes one createdAt range in the query")
    void filtersByDateRange() {
        Instant from = Instant.parse("2026-01-01T00:00:00Z");
        Instant to = Instant.parse("2026-12-31T23:59:59Z");
        Document q = searchAndCapture(null, null, null, null, from, to, 100).getQueryObject();

        Document range = q.get("createdAt", Document.class);
        assertEquals(from, range.get("$gte"));
        assertEquals(to, range.get("$lte"));
    }

    @Test
    @DisplayName("an open-ended date range only sets the side that was given")
    void filtersByOpenEndedDateRange() {
        Instant from = Instant.parse("2026-01-01T00:00:00Z");
        Document onlyFrom = searchAndCapture(null, null, null, null, from, null, 100)
                .getQueryObject().get("createdAt", Document.class);
        assertEquals(from, onlyFrom.get("$gte"));
        assertFalse(onlyFrom.containsKey("$lte"));
    }

    @Test
    @DisplayName("free text searches actor, record label and action — in the database")
    void freeTextSearchesThreeColumns() {
        Document q = searchAndCapture(null, null, null, "kowalska", null, null, 100).getQueryObject();

        @SuppressWarnings("unchecked")
        List<Document> or = (List<Document>) q.get("$or");
        assertEquals(3, or.size());
        assertTrue(or.get(0).containsKey("actorName"));
        assertTrue(or.get(1).containsKey("entityLabel"));
        assertTrue(or.get(2).containsKey("action"));
    }

    @Test
    @DisplayName("search text is matched literally and case-insensitively, never as a pattern")
    void freeTextIsQuotedAndCaseInsensitive() {
        // ".*(" would be a wildcard-plus-broken-group if it were treated as a pattern.
        String dangerous = ".*(";
        Document q = searchAndCapture(null, null, null, dangerous, null, null, 100).getQueryObject();

        @SuppressWarnings("unchecked")
        List<Document> or = (List<Document>) q.get("$or");
        Object regex = or.get(0).get("actorName");

        String pattern;
        String options;
        if (regex instanceof Pattern p) {
            pattern = p.pattern();
            options = (p.flags() & Pattern.CASE_INSENSITIVE) != 0 ? "i" : "";
        } else {
            BsonRegularExpression bson = (BsonRegularExpression) regex;
            pattern = bson.getPattern();
            options = bson.getOptions();
        }
        // \Q...\E is the "treat everything between as plain text" marker.
        assertEquals(Pattern.quote(dangerous), pattern);
        assertTrue(options.contains("i"), "search must be case-insensitive");
    }

    @Test
    @DisplayName("blank search text adds no condition at all")
    void blankTextIsIgnored() {
        Document q = searchAndCapture(null, null, null, "   ", null, null, 100).getQueryObject();
        assertFalse(q.containsKey("$or"));
    }

    @Test
    @DisplayName("the dashboard's recent lines are limited in the database too")
    void findRecentIsLimitedAndSorted() {
        repository.findRecent(TENANT, 6);
        Query query = capture();

        assertEquals(6, query.getLimit());
        assertEquals(-1, query.getSortObject().get("createdAt"));
        assertEquals(TENANT, query.getQueryObject().get("tenantId"));
    }

    @Test
    @DisplayName("findRecent also refuses an unbounded read")
    void findRecentRefusesUnboundedRead() {
        assertThrows(IllegalArgumentException.class, () -> repository.findRecent(TENANT, 0));
    }
}
