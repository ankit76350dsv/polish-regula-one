package com.ksefflow.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableScheduling turns on Spring's background timer jobs (cron-style tasks).
// KSeFFlow uses it for the offline retry queue (KsefRetryQueueService), which keeps
// trying to push offline-issued invoices to KSeF before their legal deadline, and for
// the KSeF availability monitor.
@SpringBootApplication
@EnableScheduling
public class BackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
