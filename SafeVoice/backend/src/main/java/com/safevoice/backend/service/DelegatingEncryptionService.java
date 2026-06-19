package com.safevoice.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

/**
 * Primary delegating implementation of EncryptionService.
 * Determines the active encryption implementation (AWS KMS or Local Fallback)
 * based on configuration, enabling offline unit testing and development.
 */
@Primary
@Service
public class DelegatingEncryptionService implements EncryptionService {

    private final EncryptionService activeService;

    @Autowired
    public DelegatingEncryptionService(
            @Value("${safevoice.encryption.provider:local}") String provider,
            LocalEncryptionServiceImpl localService,
            @Lazy AwsKmsEncryptionServiceImpl awsService) {
        if ("aws".equalsIgnoreCase(provider)) {
            this.activeService = awsService;
        } else {
            this.activeService = localService;
        }
    }

    @Override
    public String encrypt(String plaintext, String tenantId) {
        return activeService.encrypt(plaintext, tenantId);
    }

    @Override
    public String decrypt(String ciphertext, String tenantId) {
        return activeService.decrypt(ciphertext, tenantId);
    }
}
