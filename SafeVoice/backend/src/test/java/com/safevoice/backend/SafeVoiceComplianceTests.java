package com.safevoice.backend;

import com.safevoice.backend.listener.AuditLogImmutableListener;
import com.safevoice.backend.listener.MongoEncryptionListener;
import com.safevoice.backend.model.document.AuditLog;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.enums.case_report.ReportCategory;
import com.safevoice.backend.service.EncryptionService;
import com.safevoice.backend.service.LocalEncryptionServiceImpl;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.event.AfterLoadEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeDeleteEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeSaveEvent;
import org.springframework.data.mongodb.core.query.Query;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class SafeVoiceComplianceTests {

    private EncryptionService encryptionService;
    private MongoTemplate mockMongoTemplate;
    private MongoEncryptionListener encryptionListener;
    private AuditLogImmutableListener auditLogListener;

    @BeforeEach
    void setUp() {
        encryptionService = new LocalEncryptionServiceImpl("test-master-key-value-1234567890-test-key");
        mockMongoTemplate = Mockito.mock(MongoTemplate.class);
        encryptionListener = new MongoEncryptionListener(encryptionService, mockMongoTemplate);
        auditLogListener = new AuditLogImmutableListener();

        // Inject mockMongoTemplate into auditLogListener using reflection if needed,
        // or since it is field-injected we can use reflection or standard setup.
        // Let's use reflection to inject the mockMongoTemplate field.
        try {
            java.lang.reflect.Field field = AuditLogImmutableListener.class.getDeclaredField("mongoTemplate");
            field.setAccessible(true);
            field.set(auditLogListener, mockMongoTemplate);
        } catch (Exception e) {
            fail("Failed to set mock MongoTemplate on AuditLogImmutableListener", e);
        }
    }

    @Test
    void testLocalEncryptionDecryption() {
        String plaintext = "This is a compliance whistleblower report description.";
        String tenantId = "tenant-A";

        String ciphertext = encryptionService.encrypt(plaintext, tenantId);
        assertNotNull(ciphertext);
        assertNotEquals(plaintext, ciphertext);

        String decrypted = encryptionService.decrypt(ciphertext, tenantId);
        assertEquals(plaintext, decrypted);
    }

    @Test
    void testTenantEncryptionIsolation() {
        String plaintext = "Whistleblower report";
        String tenantA = "tenant-A";
        String tenantB = "tenant-B";

        String cipherA = encryptionService.encrypt(plaintext, tenantA);
        String cipherB = encryptionService.encrypt(plaintext, tenantB);

        assertNotNull(cipherA);
        assertNotNull(cipherB);
        // Same plaintext encrypted for different tenants must yield different keys and ciphertexts
        assertNotEquals(cipherA, cipherB);

        // Decrypting with wrong tenant must fail
        assertThrows(RuntimeException.class, () -> encryptionService.decrypt(cipherA, tenantB));
    }

    @Test
    void testMongoEncryptionListenerEncryptsStandardReport() {
        Document doc = new Document();
        doc.put("description", "Fraud occurred in procurement");
        doc.put("contactVaultRef", "contact-details-uuid");
        doc.put("tenantId", "tenant-1");

        CaseReport report = new CaseReport();
        report.setCategory(ReportCategory.FRAUD);
        report.setTenantId("tenant-1");

        BeforeSaveEvent<Object> event = new BeforeSaveEvent<>(report, doc, "case_reports");
        encryptionListener.onBeforeSave(event);

        // Description and contact details must be encrypted
        assertNotEquals("Fraud occurred in procurement", doc.getString("description"));
        assertNotEquals("contact-details-uuid", doc.getString("contactVaultRef"));

        // Let's verify we can decrypt it back
        String decryptedDesc = encryptionService.decrypt(doc.getString("description"), "tenant-1");
        assertEquals("Fraud occurred in procurement", decryptedDesc);
    }

    @Test
    void testMongoEncryptionListenerSkipsLabourDisputeReport() {
        Document doc = new Document();
        doc.put("description", "Labour dispute with manager");
        doc.put("contactVaultRef", "contact-details-uuid");
        doc.put("tenantId", "tenant-1");

        CaseReport report = new CaseReport();
        report.setCategory(ReportCategory.LABOUR_DISPUTE);
        report.setTenantId("tenant-1");

        BeforeSaveEvent<Object> event = new BeforeSaveEvent<>(report, doc, "case_reports");
        encryptionListener.onBeforeSave(event);

        // Description and contact details must remain plaintext (dynamic compliance rule)
        assertEquals("Labour dispute with manager", doc.getString("description"));
        assertEquals("contact-details-uuid", doc.getString("contactVaultRef"));
    }

    @Test
    void testMongoEncryptionListenerDecryptsStandardReport() {
        String originalDescription = "Fraud details";
        String encryptedDesc = encryptionService.encrypt(originalDescription, "tenant-1");

        Document doc = new Document();
        doc.put("description", encryptedDesc);
        doc.put("tenantId", "tenant-1");
        doc.put("category", "FRAUD");

        AfterLoadEvent<Object> event = new AfterLoadEvent<>(doc, (Class<Object>) (Class<?>) CaseReport.class, "case_reports");
        encryptionListener.onAfterLoad(event);

        assertEquals(originalDescription, doc.getString("description"));
    }

    @Test
    void testMongoEncryptionListenerSkipsDecryptingLabourDisputeReport() {
        Document doc = new Document();
        doc.put("description", "Labour dispute details");
        doc.put("tenantId", "tenant-1");
        doc.put("category", "LABOUR_DISPUTE");

        AfterLoadEvent<Object> event = new AfterLoadEvent<>(doc, (Class<Object>) (Class<?>) CaseReport.class, "case_reports");
        encryptionListener.onAfterLoad(event);

        // Remains as is
        assertEquals("Labour dispute details", doc.getString("description"));
    }

    @Test
    void testMongoEncryptionListenerEncryptsStandardMessage() {
        UUID caseId = UUID.randomUUID();
        Document doc = new Document();
        doc.put("text", "Sensitive message content");
        doc.put("caseId", caseId);
        doc.put("tenantId", "tenant-1");

        CaseMessage message = new CaseMessage();
        message.setCaseId(caseId);
        message.setTenantId("tenant-1");

        // Mock parent case report lookup -> category is FRAUD
        CaseReport parentReport = new CaseReport();
        parentReport.setCategory(ReportCategory.FRAUD);
        when(mockMongoTemplate.findOne(any(Query.class), eq(CaseReport.class))).thenReturn(parentReport);

        BeforeSaveEvent<Object> event = new BeforeSaveEvent<>(message, doc, "case_messages");
        encryptionListener.onBeforeSave(event);

        // Text must be encrypted
        assertNotEquals("Sensitive message content", doc.getString("text"));
        String decryptedText = encryptionService.decrypt(doc.getString("text"), "tenant-1");
        assertEquals("Sensitive message content", decryptedText);
    }

    @Test
    void testMongoEncryptionListenerSkipsEncryptingLabourDisputeMessage() {
        UUID caseId = UUID.randomUUID();
        Document doc = new Document();
        doc.put("text", "HR dispute message content");
        doc.put("caseId", caseId);
        doc.put("tenantId", "tenant-1");

        CaseMessage message = new CaseMessage();
        message.setCaseId(caseId);
        message.setTenantId("tenant-1");

        // Mock parent case report lookup -> category is LABOUR_DISPUTE
        CaseReport parentReport = new CaseReport();
        parentReport.setCategory(ReportCategory.LABOUR_DISPUTE);
        when(mockMongoTemplate.findOne(any(Query.class), eq(CaseReport.class))).thenReturn(parentReport);

        BeforeSaveEvent<Object> event = new BeforeSaveEvent<>(message, doc, "case_messages");
        encryptionListener.onBeforeSave(event);

        // Text must remain plaintext
        assertEquals("HR dispute message content", doc.getString("text"));
    }

    @Test
    void testAuditLogImmutableListenerPreventsUpdate() {
        UUID auditId = UUID.randomUUID();
        AuditLog existingLog = AuditLog.builder()
                .id(auditId)
                .tenantId("tenant-1")
                .actorRef("actor-123")
                .oldValue("old")
                .newValue("new")
                .build();

        // Mock exists check to return true (meaning it already exists in DB)
        when(mockMongoTemplate.exists(any(Query.class), eq(AuditLog.class))).thenReturn(true);

        BeforeConvertEvent<AuditLog> event = new BeforeConvertEvent<>(existingLog, "audit_logs");

        assertThrows(UnsupportedOperationException.class, () -> auditLogListener.onBeforeConvert(event));
    }

    @Test
    void testAuditLogImmutableListenerAllowsInsert() {
        UUID auditId = UUID.randomUUID();
        AuditLog newLog = AuditLog.builder()
                .id(auditId)
                .tenantId("tenant-1")
                .actorRef("actor-123")
                .oldValue("old")
                .newValue("new")
                .build();

        // Mock exists check to return false (meaning new entry)
        when(mockMongoTemplate.exists(any(Query.class), eq(AuditLog.class))).thenReturn(false);

        BeforeConvertEvent<AuditLog> event = new BeforeConvertEvent<>(newLog, "audit_logs");

        assertDoesNotThrow(() -> auditLogListener.onBeforeConvert(event));
    }

    @Test
    void testAuditLogImmutableListenerPreventsDelete() {
        org.bson.Document query = new org.bson.Document("_id", UUID.randomUUID());
        BeforeDeleteEvent<AuditLog> event = new BeforeDeleteEvent<>(query, AuditLog.class, "audit_logs");

        assertThrows(UnsupportedOperationException.class, () -> auditLogListener.onBeforeDelete(event));
    }
}
