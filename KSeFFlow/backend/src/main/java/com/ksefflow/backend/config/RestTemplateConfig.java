package com.ksefflow.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

// Declares the RestTemplate bean used by KSeFAuthService to call the KSeF government API.
//
// Timeouts are kept short — if KSeF does not respond in time the caller falls back
// to offline mode (Phase 4). The 30-second read timeout covers slow government responses
// during peak submission windows (e.g. end of month).
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate ksefRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(30));
        return new RestTemplate(factory);
    }
}
