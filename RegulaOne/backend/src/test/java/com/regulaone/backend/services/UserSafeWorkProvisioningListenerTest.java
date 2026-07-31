package com.regulaone.backend.services;

import com.mongodb.client.result.UpdateResult;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.SafeWorkEmployeeStubRepository;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.mapping.event.AfterSaveEvent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UserSafeWorkProvisioningListenerTest {

    @Test
    void provisionsSafeWorkStubWithPersistedMongoObjectId() {
        ObjectId userId = new ObjectId();
        User user = User.builder().id(userId.toHexString()).build();
        RecordingStubRepository repository = new RecordingStubRepository();

        UserSafeWorkProvisioningListener listener = new UserSafeWorkProvisioningListener(repository);
        listener.onAfterSave(new AfterSaveEvent<>(user, new Document(), "users"));

        assertEquals(userId, repository.provisionedUserId);
    }

    @Test
    void rejectsUserWithoutMongoObjectId() {
        User user = User.builder().id("not-an-object-id").build();
        RecordingStubRepository repository = new RecordingStubRepository();
        UserSafeWorkProvisioningListener listener = new UserSafeWorkProvisioningListener(repository);

        assertThrows(
                IllegalStateException.class,
                () -> listener.onAfterSave(new AfterSaveEvent<>(user, new Document(), "users")));
    }

    private static final class RecordingStubRepository extends SafeWorkEmployeeStubRepository {

        private ObjectId provisionedUserId;

        private RecordingStubRepository() {
            super(null);
        }

        @Override
        public UpdateResult ensureExists(ObjectId userId) {
            provisionedUserId = userId;
            return UpdateResult.acknowledged(0, 0L, null);
        }
    }
}
