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

    /**
     * Counts the messages in a case that staff have NOT read yet. A message is
     * "unread by staff" when readByAdmin is false — which is exactly how a reporter's
     * messages start out. The case register uses this number to show an unread badge.
     * Scoped to the tenant so one organisation can never see another's counts.
     */
    long countByTenantIdAndCaseIdAndReadByAdminFalse(String tenantId, String caseId);
}
