package com.regulaone.backend.common.audit;

import com.regulaone.backend.common.ClientIp;
import com.regulaone.backend.models.AuditLog;
import com.regulaone.backend.common.audit.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Writes RegulaOne's own audit entries.
 *
 * It offers ONE operation — append — because an audit trail that can be edited is
 * not an audit trail. Nothing here updates or deletes.
 *
 * A failure to write an audit entry must never break the action the user asked
 * for, so {@link #record} swallows storage errors and logs them loudly instead.
 * That is the right trade-off for a read/oversight action like the dashboard. If
 * this service is later reused for a data-changing action where the audit line is
 * legally required, that call site should treat a failed write as a failed action
 * (fail closed) rather than relying on this method's fail-open behaviour.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Append one audit entry.
     *
     * @param tenantId   the company the action concerned
     * @param userId     acting user's RegulaOne id
     * @param userEmail  acting user's e-mail
     * @param userRole   the role they held at the time
     * @param action     stable machine code, e.g. "COMPANY_OVERVIEW_VIEWED"
     * @param resource   the kind of thing acted on, e.g. "COMPANY_OVERVIEW"
     * @param resourceId its id when there is exactly one; may be null
     * @param details    extra non-sensitive context (e.g. the module codes returned)
     * @param request    the live HTTP request, used only for IP and user agent
     */
    public void record(String tenantId,
                       String userId,
                       String userEmail,
                       String userRole,
                       String action,
                       String resource,
                       String resourceId,
                       List<String> details,
                       HttpServletRequest request) {
        try {
            auditLogRepository.insert(AuditLog.builder()
                    .tenantId(tenantId)
                    .userId(userId)
                    .userEmail(userEmail)
                    .userRole(userRole)
                    .action(action)
                    .resource(resource)
                    .resourceId(resourceId)
                    .details(details)
                    .ipAddress(ClientIp.of(request))
                    .userAgent(userAgent(request))
                    .success(true)
                    .timestamp(LocalDateTime.now())
                    .build());
        } catch (RuntimeException ex) {
            // Loud log, but the user's request still succeeds — see the class note.
            log.error("[audit] could not write audit entry action={} tenant={} user={}: {}",
                    action, tenantId, userEmail, ex.getMessage());
        }
    }

    /** The caller's browser/user-agent string, capped to a sensible length. */
    private String userAgent(HttpServletRequest request) {
        if (request == null) return null;
        return truncate(request.getHeader("User-Agent"), 256);
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
