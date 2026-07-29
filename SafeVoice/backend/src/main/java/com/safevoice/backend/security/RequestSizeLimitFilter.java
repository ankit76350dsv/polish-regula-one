package com.safevoice.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Hard ceiling on the request body size for the PUBLIC reporter endpoints (`/api/safevoice/**`).
 *
 * WHY: the report-submission endpoint takes a JSON body that carries evidence files as base64.
 * Spring's multipart limits (max-file-size / max-request-size) do NOT apply to a JSON
 * @RequestBody, so without this the body was effectively unbounded — an anonymous caller could
 * POST an enormous JSON to exhaust server memory (Jackson buffers the whole body). This rejects
 * oversized requests up front (before the body is read) with HTTP 413.
 *
 * This is a coarse outer bound (it must fit a legitimate max submission: up to 5 files × ~13.4 MB
 * of base64 + fields). The per-attachment and per-count limits are enforced more precisely by
 * bean validation on CaseSubmissionRequest, and each decoded file is re-checked against the
 * 10 MB limit in AttachmentService. Multipart uploads are separately capped by Spring.
 *
 * NOTE: the check uses Content-Length, which every normal client sends. A deliberately chunked
 * request without Content-Length is not bounded here — that residual is mitigated by the per-IP
 * rate limiter; the robust long-term fix is to move submission uploads to multipart/streaming.
 */
@Slf4j
@Component
// After the Spring Security chain (CORS) so the 413 still carries CORS headers, like RateLimitFilter.
@Order(Ordered.LOWEST_PRECEDENCE)
public class RequestSizeLimitFilter extends OncePerRequestFilter {

    private static final String PUBLIC_PREFIX = "/api/safevoice/";

    private final long maxBytes;

    public RequestSizeLimitFilter(
            @Value("${safevoice.max-request-body-bytes:83886080}") long maxBytes) { // 80 MB default
        this.maxBytes = maxBytes;
    }

    // Only guard public endpoints that carry a body; skip preflight.
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        return !request.getRequestURI().startsWith(PUBLIC_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long declared = request.getContentLengthLong();
        if (declared > maxBytes) {
            log.warn("[RequestSizeLimitFilter] Rejected oversized request ({} bytes > {}) to {}",
                    declared, maxBytes, request.getRequestURI());
            reject(response);
            return;
        }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.CONTENT_TOO_LARGE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"success\":false,"
                        + "\"message\":\"The request is too large.\","
                        + "\"errorCode\":\"PAYLOAD_TOO_LARGE\","
                        + "\"status\":413}");
    }
}
