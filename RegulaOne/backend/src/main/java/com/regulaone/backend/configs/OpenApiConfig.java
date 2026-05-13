package com.regulaone.backend.configs;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures the OpenAPI / Swagger UI documentation for RegulaOne backend.
 *
 * Swagger UI is available at: http://localhost:8080/swagger-ui/index.html
 * Raw OpenAPI JSON at:        http://localhost:8080/v3/api-docs
 *
 * A "Bearer Auth" security scheme is registered so that JWT tokens can be
 * entered directly in the Swagger UI to test protected endpoints without Postman.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI regulaOneOpenAPI() {
        // Security scheme name — referenced in @SecurityRequirement annotations on controllers
        final String securitySchemeName = "bearerAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("RegulaOne API")
                        .description("Unified Compliance Platform for Polish Businesses — " +
                                "Authentication, Tenant, Package, and User Management APIs")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("RegulaOne")
                                .email("api@regulaone.pl")))

                // Register JWT bearer token as the global security scheme
                // This adds the "Authorize" button to Swagger UI
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Paste the idToken received from POST /api/auth/login")));
    }
}
