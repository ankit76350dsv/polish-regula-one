package com.regulaone.backend.services;

import com.mongodb.client.result.UpdateResult;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.SafeWorkEmployeeStubRepository;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UserSafeWorkProvisioningListenerTest {

    @Test
    void provisionsSafeWorkStubWithPersistedMongoObjectId() {
        ObjectId userId = new ObjectId();
        User user = User.builder().id(userId.toHexString()).build();
        RecordingStubRepository repository = new RecordingStubRepository();

        UserSafeWorkProvisioningListener listener = new UserSafeWorkProvisioningListener(repository);
        listener.onAfterSave(user, new Document("_id", userId), "users");

        assertEquals(userId, repository.provisionedUserId);
    }

    @Test
    void rejectsUserWithoutMongoObjectId() {
        User user = User.builder().id("not-an-object-id").build();
        RecordingStubRepository repository = new RecordingStubRepository();
        UserSafeWorkProvisioningListener listener = new UserSafeWorkProvisioningListener(repository);

        assertThrows(
                IllegalStateException.class,
                () -> listener.onAfterSave(user, new Document(), "users"));
    }

    @Test
    void ignoresUserDocumentsSavedOutsideTheUsersCollection() {
        User user = User.builder().id(new ObjectId().toHexString()).build();
        RecordingStubRepository repository = new RecordingStubRepository();
        UserSafeWorkProvisioningListener listener = new UserSafeWorkProvisioningListener(repository);

        listener.onAfterSave(user, new Document(), "archived_users");

        assertNull(repository.provisionedUserId);
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
