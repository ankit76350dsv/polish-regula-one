package com.safevoice.backend.repository;

import com.safevoice.backend.model.document.RegulaOneUser;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface RegulaOneUserRepository extends MongoRepository<RegulaOneUser, String> {

    List<RegulaOneUser> findByTenant_IdAndEnabledTrueAndPermissionsIn(
            String tenantId,
            Collection<String> permissions);
}
