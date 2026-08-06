package com.regulaone.backend.dashboard.support;

import com.regulaone.backend.dashboard.dto.CompanyOverviewResponse.AttentionItem;
import com.regulaone.backend.models.TenantModule;
import org.slf4j.Logger;

import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * The rules both dashboards follow when they read six modules at once, and when they
 * order the "needs attention" list.
 *
 * WHY THIS CLASS EXISTS
 *   The company dashboard and the personal dashboard each had their own identical copy
 *   of the wait-with-a-timeout logic and of the attention-ordering comparator. Those are
 *   behaviour decisions — how long to wait, what counts as most serious — and behaviour
 *   that is written twice eventually behaves in two different ways. Both now share this.
 *
 * The generic type parameter is what lets one method serve both: the company dashboard
 * awaits a ModuleSnapshot, the personal one a PersonalSnapshot, but the WAITING is
 * identical.
 */
public final class ModuleReads {

    /**
     * Longest a dashboard waits for one module before giving up on it.
     *
     * Chosen so a hanging collection cannot hold a page open indefinitely. Shared by
     * both dashboards on purpose, so the two screens behave alike under load.
     */
    public static final Duration MODULE_TIMEOUT = Duration.ofSeconds(12);

    private ModuleReads() {
        // Helpers only — never instantiated.
    }

    /**
     * Wait for one module's read, but never longer than {@link #MODULE_TIMEOUT}, and
     * never let its failure escape.
     *
     * @return the module's snapshot, or NULL when it could not be read in time. The
     *         caller turns null into an "UNAVAILABLE" card, which is the honest answer —
     *         showing zeroes instead would read as "nothing to worry about".
     */
    public static <T> T awaitQuietly(TenantModule module,
                                     CompletableFuture<T> future,
                                     Logger log,
                                     String logPrefix) {
        try {
            return future.get(MODULE_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            // Preserve the interrupt so the container can shut the thread down.
            Thread.currentThread().interrupt();
            log.warn("[{}] interrupted while reading module {}", logPrefix, module);
            return null;
        } catch (Exception ex) {
            log.warn("[{}] module {} could not be read: {}", logPrefix, module, ex.getMessage());
            return null;
        }
    }

    /**
     * Put the "needs attention" list in the order a person should work through it:
     * most serious first, then the biggest backlogs, then a stable name order so
     * repeated loads do not reshuffle the table under someone's cursor.
     */
    public static void sortByUrgency(List<AttentionItem> attention) {
        attention.sort(Comparator
                .comparingInt((AttentionItem item) -> toneRank(item.tone()))
                .thenComparing(Comparator.comparingInt(AttentionItem::count).reversed())
                .thenComparing(AttentionItem::type));
    }

    /** RISK sorts above WARN, which sorts above everything else. */
    public static int toneRank(String tone) {
        if ("RISK".equals(tone)) return 0;
        if ("WARN".equals(tone)) return 1;
        return 2;
    }

    /**
     * Add up the open obligations for the headline row: how many there are in total,
     * and how many of those are already a legal breach rather than a warning.
     *
     * @return a two-value holder, {@code open} then {@code overdue}
     */
    public static OpenWork countOpenWork(List<AttentionItem> attention) {
        int open = 0;
        int overdue = 0;
        for (AttentionItem item : attention) {
            open += item.count();
            if ("RISK".equals(item.tone())) overdue += item.count();
        }
        return new OpenWork(open, overdue);
    }

    /** Everything still to do, and the part of it that is already late. */
    public record OpenWork(int open, int overdue) {
    }
}
