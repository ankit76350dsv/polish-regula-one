package com.regulaone.backend.repository;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SafeWorkEmployeeStubRepositoryTest {

    @Test
    void buildsUpsertContainingOnlyMongoUserReference() {
        ObjectId userId = new ObjectId();

        assertEquals(
                new Document("userId", userId),
                SafeWorkEmployeeStubRepository.userIdQuery(userId).getQueryObject());
        assertEquals(
                new Document("$setOnInsert", new Document("userId", userId)),
                SafeWorkEmployeeStubRepository.insertOnlyUserReference(userId).getUpdateObject());
    }
}
