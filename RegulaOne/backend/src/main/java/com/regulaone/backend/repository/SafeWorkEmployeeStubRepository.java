package com.regulaone.backend.repository;

import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

/**
 * Writes the minimal SafeWork employee record that links a compliance profile
 * to the authoritative RegulaOne user identity.
 */
@Repository
@RequiredArgsConstructor
public class SafeWorkEmployeeStubRepository {

    static final String COLLECTION = "safework_employees";

    private final MongoTemplate mongoTemplate;

    /**
     * Uses an upsert so retries and later saves of the same user cannot create
     * duplicate SafeWork employee stubs.
     */
    public UpdateResult ensureExists(ObjectId userId) {
        Query query = userIdQuery(userId);
        Update insertOnlyUserReference = insertOnlyUserReference(userId);

        return mongoTemplate.upsert(query, insertOnlyUserReference, COLLECTION);
    }

    static Query userIdQuery(ObjectId userId) {
        return Query.query(Criteria.where("userId").is(userId));
    }

    static Update insertOnlyUserReference(ObjectId userId) {
        return new Update().setOnInsert("userId", userId);
    }
}
