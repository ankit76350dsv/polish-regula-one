package com.ksefflow.backend.repository;

import com.ksefflow.backend.models.KsefApiLog;
import com.ksefflow.backend.models.utils.KsefEnvironment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

// Repository for the ksef_api_logs collection.
// Entries are append-only — never modified or deleted.
public interface KsefApiLogRepository extends MongoRepository<KsefApiLog, String> {

    // Most recent API calls for a tenant — used by the Integration Center terminal
    Page<KsefApiLog> findByTenantIdOrderByTimestampDesc(String tenantId, Pageable pageable);

    // Filter by environment — prevents sandbox test logs from mixing with production records
    Page<KsefApiLog> findByTenantIdAndEnvironmentOrderByTimestampDesc(
            String tenantId, KsefEnvironment environment, Pageable pageable);

    // All logs for a specific invoice — used in the invoice detail panel
    List<KsefApiLog> findByTenantIdAndInvoiceIdOrderByTimestampDesc(String tenantId, String invoiceId);

    // Failure analysis — logs with HTTP 4xx or 5xx status codes
    Page<KsefApiLog> findByTenantIdAndStatusCodeGreaterThanEqualOrderByTimestampDesc(
            String tenantId, int minStatusCode, Pageable pageable);

    // Latency stats — used by the bar chart in the Integration Center dashboard
    List<KsefApiLog> findTop7ByTenantIdAndEnvironmentOrderByTimestampDesc(
            String tenantId, KsefEnvironment environment);
}
