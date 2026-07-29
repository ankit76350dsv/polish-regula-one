package com.privacypilot.backend.config;

import com.privacypilot.backend.security.CurrentUserContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

import java.util.Optional;

/**
 * Turns ON automatic "who and when" stamping for every database record.
 *
 * WHAT: Every record extends BaseDocument, which has these auto-filled fields:
 *   - createdAt / updatedAt  (the WHEN — filled by @CreatedDate / @LastModifiedDate)
 *   - createdBy / updatedBy  (the WHO  — filled by @CreatedBy   / @LastModifiedBy)
 * Those notes only work if Spring's auditing feature is switched on. This class
 * is the switch — {@code @EnableMongoAuditing} makes Spring fill the dates on
 * every save, and the {@link #auditorAware()} bean below tells Spring WHO the
 * current user is so it can fill createdBy / updatedBy too.
 *
 * WHY: Our audit trail and 10-year evidence rules depend on always knowing who
 * changed a record and when. Without this switch those fields would stay empty.
 */
@Configuration
@EnableMongoAuditing(auditorAwareRef = "auditorAware")
public class MongoAuditingConfig {

    /**
     * Tells Spring the id of the user doing the current action, so it can stamp
     * createdBy / updatedBy automatically.
     *
     * The id comes from {@link CurrentUserContext}, which is filled at the start of
     * every request from the verified RegulaOne session (see the argument resolver).
     * So a record's createdBy / updatedBy now hold the REAL user id.
     *
     * Fallback: when there is no user in context — for example a scheduled/background
     * job that saves outside any web request — we stamp "system" so the field is never
     * left empty.
     */
    @Bean
    public AuditorAware<String> auditorAware() {
        return () -> Optional.of(CurrentUserContext.getUserId().orElse("system"));
    }
}
