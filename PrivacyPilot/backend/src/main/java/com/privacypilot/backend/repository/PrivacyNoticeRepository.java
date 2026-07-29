package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.PrivacyNotice;
import com.privacypilot.backend.model.enums.notice.NoticeAudience;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Database access for privacy notices ({@link PrivacyNotice}, Art. 13/14 GDPR).
 *
 * Notices are VERSIONED, write-once history: generating a notice always adds a NEW
 * version and never overwrites an old one, so the company can prove what people were
 * told and when. Every finder is scoped by tenantId (one company can never read
 * another's notices) and excludes soft-deleted rows.
 */
@Repository
public interface PrivacyNoticeRepository extends MongoRepository<PrivacyNotice, String> {

    // All notices (every audience, every version) for one company, newest first.
    List<PrivacyNotice> findByTenantIdAndDeletedFalseOrderByGeneratedAtDesc(String tenantId);

    // One notice, but only if it belongs to this company (else empty → 404).
    Optional<PrivacyNotice> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

    // The latest version already generated for one audience — used to compute the next
    // version number (+1). Empty when this audience has no notice yet (→ version 1).
    Optional<PrivacyNotice> findFirstByTenantIdAndAudienceAndDeletedFalseOrderByVersionDesc(
            String tenantId, NoticeAudience audience);
}
