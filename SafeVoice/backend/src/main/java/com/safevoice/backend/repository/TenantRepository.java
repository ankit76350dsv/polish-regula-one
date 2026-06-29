package com.safevoice.backend.repository;

import com.safevoice.backend.model.document.Tenant;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/**
 * Read access to the shared "tenants" collection (managed by RegulaOne).
 * We look a tenant up by its id and check it is active before accepting a report.
 * The inherited findById(id) handles the ObjectId conversion for us.
 */
@Repository
public interface TenantRepository extends MongoRepository<Tenant, String> {
}
