package com.safevoice.backend.repository;

import com.safevoice.backend.model.document.CaseMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * MongoDB repository for managing CaseMessage chat documents.
 */
@Repository
public interface CaseMessageRepository extends MongoRepository<CaseMessage, String> {

    /**
     * Retrieves all chat logs inside a specific case, ordered by timestamp.
     * Enforces tenant isolation.
     */
    List<CaseMessage> findAllByTenantIdAndCaseIdOrderByTimestampAsc(String tenantId, String caseId);
}
