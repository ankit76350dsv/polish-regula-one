package com.regulaone.backend.controllers;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/health")
@RequiredArgsConstructor
public class HealthController {

    private final MongoTemplate mongoTemplate;

    @Value("${spring.profiles.active:default}")
    private String environment;

    @GetMapping("")
    public ResponseEntity<Map<String, String>> health() {

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "environment", environment));
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