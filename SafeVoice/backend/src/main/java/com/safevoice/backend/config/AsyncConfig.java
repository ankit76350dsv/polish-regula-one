package com.safevoice.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Enables background (@Async) execution and provides the pool used for staff email notifications.
 *
 * WHY: sending a report must NEVER wait on the email relay. Notifications run on this pool so the
 * reporter's submit returns immediately and emails go out in the background.
 */
@Slf4j
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Small, BOUNDED pool for best-effort email notifications.
     *
     * Bounded so a slow relay or a burst of reports cannot spawn unbounded threads. If the pool
     * AND its queue are full, the task is DISCARDED (with a warning) rather than thrown back to the
     * caller — a report submission must never fail or hang because of a non-critical email.
     */
    @Bean("emailNotificationExecutor")
    public Executor emailNotificationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("safevoice-email-");
        // Never propagate back to the request thread; drop (and log) if truly overloaded.
        executor.setRejectedExecutionHandler((runnable, poolExecutor) ->
                log.warn("[AsyncConfig] email notification dropped — notification pool is saturated"));
        executor.initialize();
        return executor;
    }
}
