package com.regulaone.backend.services.notification.utils;

import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Turns an event's audience into a concrete list of recipient users. This is THE reason the
 * Hub lives in RegulaOne — only here can we query the user directory and match by permission.
 *
 * Always tenant-scoped and limited to ENABLED users, so a notification is only ever created
 * for someone entitled (and able) to act on it.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecipientResolver {

    private final UserRepository userRepository;

    /** Active users in the tenant who hold ANY of the given permission codes. */
    public List<User> byPermissions(String tenantId, List<String> permissionCodes) {
        if (tenantId == null || permissionCodes == null || permissionCodes.isEmpty()) {
            return List.of();
        }
        Set<String> wanted = new HashSet<>(permissionCodes);
        return userRepository.findByTenant_IdAndEnabledTrue(tenantId).stream()
                .filter(u -> u.getPermissions() != null
                        && u.getPermissions().stream().anyMatch(wanted::contains))
                .collect(Collectors.toList());
    }

    /** Specific users by id — but restricted to the tenant + enabled (no cross-tenant leak). */
    public List<User> byIds(String tenantId, List<String> userIds) {
        if (tenantId == null || userIds == null || userIds.isEmpty()) {
            return List.of();
        }
        Set<String> ids = new HashSet<>(userIds);
        return userRepository.findByTenant_IdAndEnabledTrue(tenantId).stream()
                .filter(u -> ids.contains(u.getId()))
                .collect(Collectors.toList());
    }
}
