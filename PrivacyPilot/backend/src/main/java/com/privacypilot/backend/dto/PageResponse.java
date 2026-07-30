package com.privacypilot.backend.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * One PAGE of results, plus the few numbers a screen needs to draw "Page 3 of 12  ‹ ›".
 *
 * WHY OUR OWN SHAPE (and not Spring's Page): Spring's {@code PageImpl} was never designed to
 * be turned into JSON — its field names have changed between versions and it carries internals
 * a client should not depend on. This record is the stable contract instead: small, obvious,
 * and ours to keep.
 *
 * @param items         the rows on THIS page
 * @param page          which page this is, counting from 0
 * @param size          how many rows a page holds (the requested page size)
 * @param totalElements how many rows match the filters in total, across all pages
 * @param totalPages    how many pages that works out to (0 when there are no rows)
 * @param hasNext       true when there is another page after this one
 * @param hasPrevious   true when there is a page before this one
 * @param <T>           the row type
 */
public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext,
        boolean hasPrevious) {

    /**
     * Build the API shape from a Spring {@link Page}, converting each row on the way (for
     * example a stored document → its read-only response DTO).
     *
     * @param source the page the database gave us
     * @param mapper how to turn one stored row into one API row
     */
    public static <S, T> PageResponse<T> of(Page<S> source, Function<S, T> mapper) {
        return new PageResponse<>(
                source.getContent().stream().map(mapper).toList(),
                source.getNumber(),
                source.getSize(),
                source.getTotalElements(),
                source.getTotalPages(),
                source.hasNext(),
                source.hasPrevious());
    }
}
