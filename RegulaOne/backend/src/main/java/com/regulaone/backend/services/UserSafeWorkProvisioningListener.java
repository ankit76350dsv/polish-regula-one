package com.regulaone.backend.services;

import com.mongodb.client.result.UpdateResult;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.SafeWorkEmployeeStubRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.mapping.event.AfterSaveCallback;
import org.springframework.stereotype.Component;

/**
 * Keeps the SafeWork employee collection linked to the central identity store.
 * A synchronous entity callback is used so repository saves cannot bypass
 * provisioning and the SafeWork upsert completes before the save call returns.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserSafeWorkProvisioningListener implements AfterSaveCallback<User> {

    private final SafeWorkEmployeeStubRepository safeWorkEmployeeStubRepository;

    @Override
    public User onAfterSave(User user, Document document, String collection) {
        if (!"users".equals(collection)) {
            return user;
        }

        ObjectId userId = resolveUserId(user, document);
        UpdateResult result = safeWorkEmployeeStubRepository.ensureExists(userId);

        if (result.getUpsertedId() != null) {
            log.info("Created SafeWork employee stub for RegulaOne userId={}", userId.toHexString());
        }

        return user;
    }

    private static ObjectId resolveUserId(User user, Document document) {
        String persistedUserId = user.getId();
        if (persistedUserId != null && ObjectId.isValid(persistedUserId)) {
            return new ObjectId(persistedUserId);
        }

        Object documentId = document.get("_id");
        if (documentId instanceof ObjectId objectId) {
            return objectId;
        }

        throw new IllegalStateException("Persisted RegulaOne user does not have a valid MongoDB ObjectId");
    }
}
