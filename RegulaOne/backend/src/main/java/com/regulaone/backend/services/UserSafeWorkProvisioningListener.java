package com.regulaone.backend.services;

import com.mongodb.client.result.UpdateResult;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.SafeWorkEmployeeStubRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.AfterSaveEvent;
import org.springframework.stereotype.Component;

/**
 * Keeps the SafeWork employee collection linked to the central identity store.
 * The listener is centralised so every RegulaOne user creation path is covered.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserSafeWorkProvisioningListener extends AbstractMongoEventListener<User> {

    private final SafeWorkEmployeeStubRepository safeWorkEmployeeStubRepository;

    @Override
    public void onAfterSave(AfterSaveEvent<User> event) {
        String persistedUserId = event.getSource().getId();
        if (persistedUserId == null || !ObjectId.isValid(persistedUserId)) {
            throw new IllegalStateException("Persisted RegulaOne user does not have a valid MongoDB ObjectId");
        }

        ObjectId userId = new ObjectId(persistedUserId);
        UpdateResult result = safeWorkEmployeeStubRepository.ensureExists(userId);

        if (result.getUpsertedId() != null) {
            log.info("Created SafeWork employee stub for RegulaOne userId={}", persistedUserId);
        }
    }
}
