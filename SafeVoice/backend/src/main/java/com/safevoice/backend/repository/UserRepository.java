package com.safevoice.backend.repository;

import com.safevoice.backend.model.document.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Read-only access to the shared "users" collection (owned by RegulaOne).
 * Used only to resolve a staff member's tenant + permissions when they open a WebSocket.
 */
@Repository
public interface UserRepository extends MongoRepository<User, String> {

    /**
     * Find a user by their Cognito subject (the "sub" claim of the verified SSO token).
     */
    Optional<User> findByCognitoSub(String cognitoSub);
}
