package com.ksefflow.backend.services;

import com.ksefflow.backend.models.KsefAuditLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class KSeFAuditLogService {

    private final MongoTemplate mongoTemplate;

    /**
     * Returns a paginated, filtered view of the audit log for a single tenant.
     *
     * All parameters except tenantId are optional.
     *
     * @param tenantId  mandatory tenant scope — cross-tenant access is never allowed
     * @param fromIso   ISO-8601 datetime lower bound (inclusive), e.g. "2026-01-01T00:00:00"
     * @param toIso     ISO-8601 datetime upper bound (inclusive)
     * @param role      exact userRole match (e.g. "Accountant", "Super Admin")
     * @param search    case-insensitive substring match across userEmail, action, ipAddress, newValue
     * @param pageable  page / size / sort — defaults to page=0, size=20, sort=timestamp desc
     */
    public Page<KsefAuditLog> listAuditLogs(
            String tenantId,
            String fromIso,
            String toIso,
            String role,
            String search,
            Pageable pageable) {

        List<Criteria> criteriaList = new ArrayList<>();

        // Mandatory tenant isolation
        criteriaList.add(Criteria.where("tenantId").is(tenantId));

        // Optional date range
        LocalDateTime from = parseDateTime(fromIso);
        LocalDateTime to   = parseDateTime(toIso);
        if (from != null || to != null) {
            Criteria timeCriteria = Criteria.where("timestamp");
            if (from != null) timeCriteria = timeCriteria.gte(from);
            if (to   != null) timeCriteria = timeCriteria.lte(to);
            criteriaList.add(timeCriteria);
        }

        // Optional role filter (exact match)
        if (role != null && !role.isBlank() && !"ALL".equals(role)) {
            criteriaList.add(Criteria.where("userRole").is(role));
        }

        // Optional full-text search across audit-relevant string fields
        if (search != null && !search.isBlank()) {
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("userEmail").regex(search, "i"),
                    Criteria.where("action").regex(search, "i"),
                    Criteria.where("ipAddress").regex(search, "i"),
                    Criteria.where("newValue").regex(search, "i")
            ));
        }

        Criteria finalCriteria = new Criteria().andOperator(
                criteriaList.toArray(new Criteria[0]));

        // Separate count query (no pagination applied) for accurate totalElements
        Query countQuery = new Query(finalCriteria);
        long total = mongoTemplate.count(countQuery, KsefAuditLog.class);

        // Data query with sort + pagination
        Query dataQuery = new Query(finalCriteria)
                .with(org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "timestamp"))
                .with(pageable);
        List<KsefAuditLog> logs = mongoTemplate.find(dataQuery, KsefAuditLog.class);

        return new PageImpl<>(logs, pageable, total);
    }

    private LocalDateTime parseDateTime(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return LocalDateTime.parse(iso, DateTimeFormatter.ISO_DATE_TIME);
        } catch (DateTimeParseException e) {
            log.debug("Ignoring unparseable datetime filter value: {}", iso);
            return null;
        }
    }
}
