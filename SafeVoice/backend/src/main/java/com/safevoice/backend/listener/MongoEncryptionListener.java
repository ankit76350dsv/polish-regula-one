package com.safevoice.backend.listener;

import com.safevoice.backend.model.annotation.Encrypted;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.enums.case_report.ReportCategory;
import com.safevoice.backend.service.EncryptionService;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.AfterLoadEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeSaveEvent;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * MongoDB event listener that intercepts save and load lifecycle events to enforce
 * client-side field-level encryption on fields annotated with {@link Encrypted}.
 * Skips encryption/decryption if the case report category is LABOUR_DISPUTE.
 */
@Component
public class MongoEncryptionListener extends AbstractMongoEventListener<Object> {

    private final EncryptionService encryptionService;
    private final MongoTemplate mongoTemplate;
    private final Map<Class<?>, List<String>> encryptedFieldsCache = new ConcurrentHashMap<>();

    @Autowired
    public MongoEncryptionListener(EncryptionService encryptionService, @Lazy MongoTemplate mongoTemplate) {
        this.encryptionService = encryptionService;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void onBeforeSave(BeforeSaveEvent<Object> event) {
        Object source = event.getSource();
        if (source == null) {
            return;
        }

        Class<?> clazz = source.getClass();
        List<String> encryptedFields = getEncryptedFields(clazz);
        if (encryptedFields.isEmpty()) {
            return;
        }

        Document document = event.getDocument();
        if (document == null) {
            return;
        }

        // Apply labour dispute rule (do NOT encrypt if category is LABOUR_DISPUTE)
        if (source instanceof CaseReport report && report.getCategory() == ReportCategory.LABOUR_DISPUTE) {
            return;
        }
        if (source instanceof CaseMessage message && isLabourDisputeCase(message.getCaseId())) {
            return;
        }

        // Verify if we actually have fields to encrypt before checking tenantId
        boolean hasValuesToEncrypt = false;
        for (String fieldName : encryptedFields) {
            Object val = document.get(fieldName);
            if (val instanceof String plaintext && !plaintext.trim().isEmpty()) {
                hasValuesToEncrypt = true;
                break;
            }
        }

        if (!hasValuesToEncrypt) {
            return;
        }

        // Retrieve tenantId for key derivation
        String tenantId = document.getString("tenantId");
        if (tenantId == null || tenantId.trim().isEmpty()) {
            tenantId = getTenantIdFromEntity(source);
        }

        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new IllegalStateException("Tenant ID is missing. Cannot encrypt sensitive fields without tenant context.");
        }

        for (String fieldName : encryptedFields) {
            Object val = document.get(fieldName);
            if (val instanceof String plaintext && !plaintext.trim().isEmpty()) {
                String encrypted = encryptionService.encrypt(plaintext, tenantId);
                document.put(fieldName, encrypted);
            }
        }
    }

    @Override
    public void onAfterLoad(AfterLoadEvent<Object> event) {
        Class<?> clazz = event.getType();
        List<String> encryptedFields = getEncryptedFields(clazz);
        if (encryptedFields.isEmpty()) {
            return;
        }

        Document document = event.getDocument();
        if (document == null) {
            return;
        }

        // Apply labour dispute rule (do NOT decrypt if category was LABOUR_DISPUTE)
        if (CaseReport.class.isAssignableFrom(clazz)) {
            String categoryStr = document.getString("category");
            if ("LABOUR_DISPUTE".equals(categoryStr)) {
                return;
            }
        }
        if (CaseMessage.class.isAssignableFrom(clazz)) {
            Object caseIdObj = document.get("caseId");
            if (isLabourDisputeCase(caseIdObj)) {
                return;
            }
        }

        // Verify if we actually have fields to decrypt
        boolean hasValuesToDecrypt = false;
        for (String fieldName : encryptedFields) {
            Object val = document.get(fieldName);
            if (val instanceof String ciphertext && !ciphertext.trim().isEmpty()) {
                hasValuesToDecrypt = true;
                break;
            }
        }

        if (!hasValuesToDecrypt) {
            return;
        }

        String tenantId = document.getString("tenantId");
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new IllegalStateException("Tenant ID is missing on database load for encrypted fields.");
        }

        for (String fieldName : encryptedFields) {
            Object val = document.get(fieldName);
            if (val instanceof String ciphertext && !ciphertext.trim().isEmpty()) {
                // If it is not actually Base64 encoded or is a plaintext (e.g. legacy data),
                // we handle decryption failure gracefully or decrypt
                try {
                    String decrypted = encryptionService.decrypt(ciphertext, tenantId);
                    document.put(fieldName, decrypted);
                } catch (Exception e) {
                    // Log warning and leave as is to prevent crashing on unencrypted dev data
                }
            }
        }
    }

    private List<String> getEncryptedFields(Class<?> clazz) {
        return encryptedFieldsCache.computeIfAbsent(clazz, cl -> {
            List<String> fields = new ArrayList<>();
            Class<?> current = cl;
            while (current != null && current != Object.class) {
                for (Field field : current.getDeclaredFields()) {
                    if (field.isAnnotationPresent(Encrypted.class)) {
                        fields.add(field.getName());
                    }
                }
                current = current.getSuperclass();
            }
            return fields;
        });
    }

    private boolean isLabourDisputeCase(Object caseIdObj) {
        if (caseIdObj == null) {
            return false;
        }
        try {
            Query query = Query.query(Criteria.where("_id").is(caseIdObj));
            query.fields().include("category");
            CaseReport report = mongoTemplate.findOne(query, CaseReport.class);
            return report != null && report.getCategory() == ReportCategory.LABOUR_DISPUTE;
        } catch (Exception e) {
            return false;
        }
    }

    private String getTenantIdFromEntity(Object entity) {
        Class<?> current = entity.getClass();
        while (current != null && current != Object.class) {
            try {
                Field field = current.getDeclaredField("tenantId");
                field.setAccessible(true);
                return (String) field.get(entity);
            } catch (NoSuchFieldException e) {
                current = current.getSuperclass();
            } catch (Exception e) {
                break;
            }
        }
        return null;
    }
}
