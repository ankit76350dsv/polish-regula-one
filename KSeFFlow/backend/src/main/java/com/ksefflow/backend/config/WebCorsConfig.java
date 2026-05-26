package com.ksefflow.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

// CORS policy for the KSeFFlow REST API.
// Allows the Vite dev server (http://localhost:3001) to call the Spring Boot backend
// without browser cross-origin blocks during local development.
//
// Phase 5 (Spring Security / JWT) will add a SecurityFilterChain that also handles
// CORS via corsConfigurationSource(); this bean stays in place for the pre-auth phase.
@Configuration
public class WebCorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins("http://localhost:3001")
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .exposedHeaders("Content-Disposition")
                        .allowCredentials(false)
                        .maxAge(3600);
            }
        };
    }
}
