package com.safevoice.backend.listener;

import com.safevoice.backend.model.document.AuditLog;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeDeleteEvent;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;

/**
 * Unit tests proving audit logs are append-only: updates and deletes are blocked, while
 * inserting a brand-new entry is allowed.
 */
@ExtendWith(MockitoExtension.class)
class AuditLogImmutableListenerTest {

    @Mock
    private MongoTemplate mongoTemplate;

    private AuditLogImmutableListener listener() {
        AuditLogImmutableListener l = new AuditLogImmutableListener();
        ReflectionTestUtils.setField(l, "mongoTemplate", mongoTemplate);
        return l;
    }

    @Test
    void delete_isAlwaysBlocked() {
        BeforeDeleteEvent<AuditLog> event =
                new BeforeDeleteEvent<>(new Document(), AuditLog.class, "safevoice_audit_logs");
        assertThatThrownBy(() -> listener().onBeforeDelete(event))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void update_ofExistingEntryIsBlocked() {
        AuditLog existing = AuditLog.builder().id("id1").build();
        lenient().when(mongoTemplate.exists(any(Query.class), eq(AuditLog.class))).thenReturn(true);

        assertThatThrownBy(() ->
                listener().onBeforeConvert(new BeforeConvertEvent<>(existing, "safevoice_audit_logs")))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void insert_ofNewEntryIsAllowed() {
        AuditLog fresh = AuditLog.builder().build(); // id is null → a new insert
        assertThatCode(() ->
                listener().onBeforeConvert(new BeforeConvertEvent<>(fresh, "safevoice_audit_logs")))
                .doesNotThrowAnyException();
    }

    @Test
    void reinsertWithIdThatDoesNotExistIsAllowed() {
        AuditLog withId = AuditLog.builder().id("id-new").build();
        lenient().when(mongoTemplate.exists(any(Query.class), eq(AuditLog.class))).thenReturn(false);
        assertThatCode(() ->
                listener().onBeforeConvert(new BeforeConvertEvent<>(withId, "safevoice_audit_logs")))
                .doesNotThrowAnyException();
    }
}
