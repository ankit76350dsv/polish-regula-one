package com.regulaone.backend.repository;

import com.regulaone.backend.models.Role;
import com.regulaone.backend.models.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByEmail(String email);

    Optional<User> findByCognitoSub(String cognitoSub);

    boolean existsByEmail(String email);

    boolean existsByCognitoSub(String cognitoSub);

    long countByTenant_Id(String tenantId);
    List<User> findByTenant_Id(String tenantId);
    // Active members of a tenant — used by the notification recipient resolver.
    List<User> findByTenant_IdAndEnabledTrue(String tenantId);
        long countByTenant_IdAndEnabledTrue(String tenantId);

    long countByTenant_IdAndEnabledFalse(String tenantId);


    long countByEnabledTrue();

long countByEnabledFalse();

long countByRole(Role role);

}
