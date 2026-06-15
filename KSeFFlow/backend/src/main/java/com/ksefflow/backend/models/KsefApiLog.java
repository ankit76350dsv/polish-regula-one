package com.ksefflow.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import com.ksefflow.backend.models.utils.KsefEnvironment;

import java.time.LocalDateTime;

// Raw HTTP log for every call made to the Polish KSeF government API.
//
// Displayed in the Integration Center "terminal" view with syntax-highlighted
// request/response payloads. Also used for:
//   - SLA latency dashboards (responseTimeMs)
//   - Failure analysis (status >= 400)
//   - Compliance evidence that correct API calls were made
//   - Correlation with KsefInvoice records via invoiceId
//
// Entries are append-only. The clearLogs() UI action only clears the in-memory
// state; the database records are retained for audit purposes.
//
// Sensitive data rules: requestPayload/responsePayload MUST NOT contain
// certificate passwords, private keys, or raw JWT tokens — redact before storage.
@Document(collection = "ksef_api_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(def = "{'tenantId': 1, 'timestamp': -1}")
public class KsefApiLog {

    @Id
    private String id;

    // ── Multi-tenancy ──────────────────────────────────────────────────────────

    @Indexed
    private String tenantId;

    // ── HTTP call details ──────────────────────────────────────────────────────

    // HTTP method string — "GET", "POST", "PUT", "DELETE"
    private String httpMethod;

    // Relative KSeF API path e.g. "/api/online/Session/AuthorisationChallenge"
    private String endpoint;

    private int statusCode;

    // JSON payload sent to the KSeF API — truncated to 10 KB max to prevent
    // oversized documents in MongoDB; full payload archived separately if needed
    private String requestPayload;

    // JSON response received from the KSeF API — same 10 KB limit applies
    private String responsePayload;

    // ── Performance ────────────────────────────────────────────────────────────

    // Round-trip latency in milliseconds — used for the latency bar chart in the UI
    private long responseTimeMs;

    // ── Context ────────────────────────────────────────────────────────────────

    // SANDBOX or PRODUCTION — prevents test logs from being confused with live records
    private KsefEnvironment environment;

    // MongoDB ID of the KsefInvoice this call was made for — null for health checks
    private String invoiceId;

    // KSeF session token that was active when this call was made
    private String sessionId;

    // KSeF API correlation ID returned in the response headers (X-KSeF-CorrelationId)
    private String ksefCorrelationId;

    // ── Immutable timestamp ────────────────────────────────────────────────────

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
