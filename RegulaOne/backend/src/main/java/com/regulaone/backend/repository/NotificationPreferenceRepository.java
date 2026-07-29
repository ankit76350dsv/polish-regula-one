package com.regulaone.backend.repository;

import com.regulaone.backend.models.notification.NotificationPreference;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface NotificationPreferenceRepository extends MongoRepository<NotificationPreference, String> {
    Optional<NotificationPreference> findByUserId(String userId);
}
