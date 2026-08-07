package com.regulaone.backend.user;

import com.mongodb.client.result.UpdateResult;
import com.regulaone.backend.models.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.stereotype.Service;

/** Creates the minimal SafeWork reference immediately after a new user is saved. */
@Service
@RequiredArgsConstructor
@Slf4j
public class SafeWorkEmployeeProvisioningService {

    private final SafeWorkEmployeeStubRepository safeWorkEmployeeStubRepository;

    public void provision(User persistedUser) {
        String persistedUserId = persistedUser.getId();
        if (persistedUserId == null || !ObjectId.isValid(persistedUserId)) {
            throw new IllegalStateException("Persisted RegulaOne user does not have a valid MongoDB ObjectId");
        }

        UpdateResult result = safeWorkEmployeeStubRepository.ensureExists(new ObjectId(persistedUserId));
        if (result.getUpsertedId() != null) {
            log.info("Created SafeWork employee stub for RegulaOne userId={}", persistedUserId);
        }
    }
}
