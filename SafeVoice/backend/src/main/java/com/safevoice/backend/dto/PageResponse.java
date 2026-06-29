package com.safevoice.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A simple, reusable "one page of results" envelope.
 *
 * Instead of returning a bare list, a paginated endpoint returns this so the caller
 * knows not just the rows on this page (items) but also where they are in the whole
 * set: which page this is, how big a page is, how many rows exist in total, and how
 * many pages that makes. The web app uses those numbers to draw the pager.
 *
 * @param <T> the type of one row (here, a case summary)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {

    // The rows on THIS page only.
    private List<T> items;

    // Which page this is (1-based, so the first page is 1).
    private int page;

    // How many rows one page holds at most.
    private int size;

    // How many rows match in total (across every page), before paging.
    private long total;

    // How many pages that total makes at the current page size (0 when nothing matches).
    private int totalPages;
}
