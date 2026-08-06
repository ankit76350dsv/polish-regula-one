package com.regulaone.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * The small thread pool the company dashboard uses to read the six compliance
 * modules at the same time.
 *
 * WHY: the dashboard asks six different modules for their numbers. Done one after
 * another, the page would wait for the slowest chain of database round trips.
 * Asking all six at once turns that into roughly the time of the single slowest
 * module, which is what a dashboard needs.
 *
 * WHY A DEDICATED POOL AND NOT THE COMMON ForkJoinPool: the common pool is shared
 * with everything else in the JVM. Database reads spend their time waiting on the
 * network, so parking them in the common pool can starve unrelated work. A small
 * named pool also makes the threads obvious in a stack dump.
 *
 * SIZING: six worker threads — one per module — with a short queue and no
 * unbounded growth, so a burst of dashboard loads cannot exhaust the server.
 * When every thread is busy the extra work waits its turn instead of spawning
 * new threads.
 *
 * Nothing security-sensitive is passed across these threads: each module reader is
 * handed the company id explicitly, so tenant isolation does not depend on any
 * thread-local state being copied.
 */
@Configuration
public class DashboardConfig {

    /** One worker per compliance module. */
    private static final int MODULE_COUNT = 6;

    @Bean(name = "dashboardExecutor", destroyMethod = "shutdown")
    public ThreadPoolTaskExecutor dashboardExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(MODULE_COUNT);
        executor.setMaxPoolSize(MODULE_COUNT);
        executor.setQueueCapacity(MODULE_COUNT * 8);
        executor.setThreadNamePrefix("dashboard-");

        // If the queue is full, run the task on the calling thread instead of
        // throwing. The dashboard then degrades to being slower rather than failing.
        executor.setRejectedExecutionHandler(
                new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());

        // Let in-flight module reads finish when the application shuts down.
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);

        executor.initialize();
        return executor;
    }
}
