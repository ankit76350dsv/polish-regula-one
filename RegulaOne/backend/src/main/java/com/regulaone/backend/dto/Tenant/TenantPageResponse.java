package com.regulaone.backend.dto.Tenant;

import lombok.Builder;
import lombok.Data;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Wraps a Spring Data Page<TenantResponse> into a plain JSON-friendly object.
 *
 * Spring's Page<T> works fine internally but serialises with extra metadata
 * that can be noisy for API consumers. This DTO exposes only what the client needs:
 * the content list and the pagination summary.
 */
@Data
@Builder
public class TenantPageResponse {

    // The tenants for the current page
    private List<TenantResponse> content;

    // Zero-based current page index
    private int page;

    // Number of items requested per page
    private int size;

    // Total number of tenants matching the search/filter criteria
    private long totalElements;

    // Total number of pages (ceil(totalElements / size))
    private int totalPages;

    // true if this is the last page
    private boolean last;

    /**
     * Convenience factory — converts a Spring Page<TenantResponse> directly.
     * Used in TenantService so the controller stays clean.
     */
    public static TenantPageResponse from(Page<TenantResponse> page) {
        return TenantPageResponse.builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
