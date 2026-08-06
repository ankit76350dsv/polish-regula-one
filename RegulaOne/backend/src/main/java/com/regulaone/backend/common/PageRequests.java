package com.regulaone.backend.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Builds a safe {@link Pageable} out of raw {@code page} / {@code size} /
 * {@code sortBy} / {@code sortDir} query parameters.
 *
 * WHY THIS EXISTS
 *   Two list endpoints (tenants and packages) had the very same four lines of
 *   page-building code copied into them. Copied code drifts: fix the page-size cap in
 *   one place and forget the other, and one endpoint can suddenly be asked for a
 *   million rows in a single request. The rule now lives in one place.
 *
 * THE SAFETY RULE IT KEEPS
 *   A caller may ask for any page size, but never more than {@link #MAX_PAGE_SIZE}
 *   rows at once. That stops one request from pulling a whole collection into memory
 *   (a cheap way to make a server fall over).
 */
public final class PageRequests {

    /** Most rows one request may ever ask for. */
    public static final int MAX_PAGE_SIZE = 100;

    private PageRequests() {
        // Helper class — never instantiated.
    }

    /**
     * @param page    zero-based page index as supplied by the caller
     * @param size    requested rows per page; capped at {@link #MAX_PAGE_SIZE}
     * @param sortBy  the field to order by
     * @param sortDir "asc" for ascending; anything else means descending
     */
    public static Pageable of(int page, int size, String sortBy, String sortDir) {
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        return PageRequest.of(page, safeSize, Sort.by(direction, sortBy));
    }
}
