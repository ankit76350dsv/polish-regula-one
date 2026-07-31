package com.regulaone.backend.services;

import com.mongodb.client.result.UpdateResult;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.SafeWorkEmployeeStubRepository;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SafeWorkEmployeeProvisioningServiceTest {

    @Test
    void provisionsUsingThePersistedUserObjectId() {
        ObjectId userId = new ObjectId();
        RecordingRepository repository = new RecordingRepository();
        SafeWorkEmployeeProvisioningService service = new SafeWorkEmployeeProvisioningService(repository);

        service.provision(User.builder().id(userId.toHexString()).build());

        assertEquals(userId, repository.provisionedUserId);
    }

    @Test
    void rejectsAUserWithoutAValidObjectId() {
        SafeWorkEmployeeProvisioningService service =
                new SafeWorkEmployeeProvisioningService(new RecordingRepository());

        assertThrows(
                IllegalStateException.class,
                () -> service.provision(User.builder().id("invalid").build()));
    }

    private static final class RecordingRepository extends SafeWorkEmployeeStubRepository {

        private ObjectId provisionedUserId;

        private RecordingRepository() {
            super(null);
        }

        @Override
        public UpdateResult ensureExists(ObjectId userId) {
            provisionedUserId = userId;
            return UpdateResult.acknowledged(0, 0L, null);
        }
    }
}
