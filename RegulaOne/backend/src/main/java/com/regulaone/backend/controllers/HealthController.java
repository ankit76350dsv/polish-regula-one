package com.regulaone.backend.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
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

    @GetMapping("")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @GetMapping("/db")
    public ResponseEntity<?> dbTest() {
        try {
            String dbName = mongoTemplate.getDb().getName();
            Set<String> collections = mongoTemplate.getCollectionNames();
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "database", dbName,
                    "collections", collections
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "connected", false,
                    "error", e.getClass().getName(),
                    "message", e.getMessage()
            ));
        }
    }
}