package com.regulaone.backend.common;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Is this service up, and WHICH build is it?
 *
 * GET /health is public (see SecurityConfig) so a load balancer can call it without a
 * token. It answers four things, and the last two are what make it useful after a
 * deployment rather than just a liveness ping:
 *
 *   status       always "ok" if the web server is answering at all
 *   environment  the active Spring profile — confirms SPRING_PROFILES_ACTIVE landed
 *   version      the build this container was made from (see app.version below)
 *   startedAt    when THIS container started, and how long it has been up
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not touch MongoDB. Spring Data connects
 * lazily, so this endpoint answers "ok" even when the database is unreachable. Treat it
 * as "the process is alive", not "everything works". A real dependency check belongs in
 * Actuator's /actuator/health, which is not on the classpath yet.
 */
@RestController
@RequestMapping("/health")
@RequiredArgsConstructor
public class HealthController {

    /** Timestamps are shown on the company's own clock — Poland is the primary market. */
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    /** e.g. "6 Aug 2026, 15:12:18 CEST" — meant to be read, not parsed. */
    private static final DateTimeFormatter READABLE =
            DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm:ss z").withLocale(Locale.ENGLISH);

    /**
     * When this container came up.
     *
     * Set once, when Spring creates this bean during start-up, and never again — so if
     * the value moves, the container restarted. That is the single most useful thing this
     * endpoint can tell you: a service that keeps "coming back" is crash-looping, and
     * without this you would only see that it is up right now.
     */
    private final Instant startedAt = Instant.now();

    private final MongoTemplate mongoTemplate;

    @Value("${spring.profiles.active:default}")
    private String environment;

    /**
     * The build number, supplied by the pipeline.
     *
     * The deployment workflow passes GitHub's run number in as a Docker build argument,
     * which the image exposes as APP_VERSION, which binds to this property. So it goes up
     * by one on every deployment, with no file to edit and nothing to remember.
     *
     * "dev" when nothing set it — i.e. running from your IDE or a local docker build.
     */
    @Value("${app.version:dev}")
    private String version;

    @GetMapping("")
    public ResponseEntity<Map<String, String>> health() {

        // LinkedHashMap, not Map.of: this is read by people, and Map.of has no defined
        // iteration order, so the fields would shuffle between calls.
        Map<String, String> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("environment", environment);
        body.put("version", version);
        body.put("startedAt", READABLE.format(startedAt.atZone(WARSAW)));
        body.put("uptime", humanUptime(Duration.between(startedAt, Instant.now())));
        body.put("context", "Working on the https...");

        return ResponseEntity.ok(body);
    }

    /**
     * A duration a person can read at a glance: "3d 4h 12m", "8m 3s", "12s".
     *
     * Only the two largest units that matter are shown — "3d 4h" is what you want to
     * know, "3d 4h 12m 6s" is noise.
     */
    private String humanUptime(Duration up) {
        long days = up.toDays();
        long hours = up.toHoursPart();
        long minutes = up.toMinutesPart();
        long seconds = up.toSecondsPart();

        if (days > 0) return days + "d " + hours + "h";
        if (hours > 0) return hours + "h " + minutes + "m";
        if (minutes > 0) return minutes + "m " + seconds + "s";
        return seconds + "s";
    }

    @GetMapping("/db")
    public ResponseEntity<?> dbTest() {

        String activeProfile = environment;

        // Allow only dev profile
        if (!activeProfile.equals("dev")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                    Map.of(
                            "connected", false,
                            "message", "Database details are available only in dev profile"));
        }

        try {
            String dbName = mongoTemplate.getDb().getName();
            Set<String> collections = mongoTemplate.getCollectionNames();

            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "environment", activeProfile,
                    "database", dbName,
                    "collections", collections));

        } catch (Exception e) {

            return ResponseEntity.ok(Map.of(
                    "connected", false,
                    "error", e.getClass().getSimpleName(),
                    "message", e.getMessage()));
        }
    }
}