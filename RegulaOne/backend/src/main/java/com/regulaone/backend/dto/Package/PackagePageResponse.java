package com.regulaone.backend.dto.Package;

import lombok.Builder;
import lombok.Data;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Wraps a paginated list of PackageResponse into a plain JSON-friendly object.
 * Follows the same pattern as TenantPageResponse for API consistency.
 */
@Data
@Builder
public class PackagePageResponse {

    private List<PackageResponse> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean last;

    public static PackagePageResponse from(Page<PackageResponse> page) {
        return PackagePageResponse.builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
