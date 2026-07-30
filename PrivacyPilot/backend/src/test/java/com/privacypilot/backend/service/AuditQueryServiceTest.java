package com.privacypilot.backend.service;

import com.privacypilot.backend.dto.PageResponse;
import com.privacypilot.backend.dto.audit.AuditEntryResponse;
import com.privacypilot.backend.model.document.AuditEntry;
import com.privacypilot.backend.repository.AuditEntryRepository;
import com.privacypilot.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Checks how the service turns what a CLIENT asked for into a safe page request.
 *
 * This is the layer that stops "?size=999999" from turning the audit endpoint back into the
 * unbounded read that used to break it, so the caps are pinned here.
 */
class AuditQueryServiceTest {

    private AuditEntryRepository repository;
    private AuditQueryService service;
    private AuthenticatedUser caller;

    @BeforeEach
    void setUp() {
        repository = mock(AuditEntryRepository.class);
        service = new AuditQueryService(repository);
        caller = new AuthenticatedUser("user-1", "Anna", "anna@example.com", "ROLE_USER",
                "tenant-1", "ABC", "ACTIVE", List.of("PRIVACYPILOT_AUDITOR"));
        when(repository.search(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(Page.empty());
    }

    /**
     * Call list() and hand back the Pageable the repository actually received. Earlier calls
     * are cleared first so a test may capture more than once without the verification
     * tripping over the previous invocation.
     */
    private Pageable capturePageable(Integer page, Integer size) {
        clearInvocations(repository);
        service.list(caller, null, null, null, null, null, null, page, size);
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).search(eq("tenant-1"), any(), any(), any(), any(), any(), any(),
                captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("uses a sensible default page size when the client does not say")
    void defaultsPageSize() {
        Pageable pageable = capturePageable(null, null);
        assertEquals(0, pageable.getPageNumber());
        assertEquals(AuditQueryService.DEFAULT_PAGE_SIZE, pageable.getPageSize());
    }

    @Test
    @DisplayName("honours a page size the client asks for")
    void honoursRequestedSize() {
        assertEquals(50, capturePageable(2, 50).getPageSize());
        assertEquals(2, capturePageable(2, 50).getPageNumber());
    }

    @Test
    @DisplayName("trims an oversized page down to the ceiling — no unbounded reads")
    void capsOversizedPage() {
        assertEquals(AuditQueryService.MAX_PAGE_SIZE, capturePageable(0, 999_999).getPageSize());
    }

    @Test
    @DisplayName("treats a zero or negative page size as 'use the default'")
    void ignoresNonPositiveSize() {
        assertEquals(AuditQueryService.DEFAULT_PAGE_SIZE, capturePageable(0, 0).getPageSize());
        assertEquals(AuditQueryService.DEFAULT_PAGE_SIZE, capturePageable(0, -10).getPageSize());
    }

    @Test
    @DisplayName("treats a negative page number as the first page")
    void clampsNegativePage() {
        assertEquals(0, capturePageable(-3, 25).getPageNumber());
    }

    @Test
    @DisplayName("passes the page counters through so the screen can draw its pager")
    void mapsPageCounters() {
        AuditEntry entry = new AuditEntry();
        entry.setId("a1");
        when(repository.search(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(entry), PageRequest.of(1, 2), 7));

        PageResponse<AuditEntryResponse> result =
                service.list(caller, null, null, null, null, null, null, 1, 2);

        assertEquals(1, result.items().size());
        assertEquals("a1", result.items().get(0).id());
        assertEquals(1, result.page());
        assertEquals(2, result.size());
        assertEquals(7, result.totalElements());
        assertEquals(4, result.totalPages());
        assertTrue(result.hasNext());
        assertTrue(result.hasPrevious());
    }

    @Test
    @DisplayName("an empty trail is an empty page, not an error")
    void emptyTrailIsAnEmptyPage() {
        PageResponse<AuditEntryResponse> result =
                service.list(caller, null, null, null, null, null, null, null, null);

        assertTrue(result.items().isEmpty());
        assertEquals(0, result.totalElements());
        assertFalse(result.hasNext());
        assertFalse(result.hasPrevious());
    }
}
