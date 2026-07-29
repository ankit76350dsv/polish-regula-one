package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.Tenant;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * Read-only access to the SHARED "tenants" collection that RegulaOne owns.
 *
 * PrivacyPilot never creates or edits a tenant — companies are managed on
 * RegulaOne's own company-profile page. We only look a tenant up by its id
 * (which is the tenantId carried on the verified session) to READ the company's
 * legal identity for the ROPA header and privacy/breach documents.
 *
 * MongoRepository already gives us findById(id); no custom finders are needed.
 */
public interface TenantRepository extends MongoRepository<Tenant, String> {
}
