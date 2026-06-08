package com.ksefflow.backend.config;

import com.ksefflow.backend.dto.ksefapi.FormCode;
import com.ksefflow.backend.models.utils.KsefEnvironment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.NestedConfigurationProperty;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

// Typed configuration for KSeF government API connection.
// Bound from application-{profile}.properties — validated at startup.
//
// ksef.api.environment controls which base URL is used at runtime.
// Dev profile always sets SANDBOX — prod profile always sets PRODUCTION.
// This prevents sandbox invoices accidentally going to the live system.
@Component
@ConfigurationProperties(prefix = "ksef.api")
@Validated
@Data
public class KsefApiProperties {

    // KSeF test/sandbox API base URL — for development and integration testing
    @NotBlank(message = "ksef.api.sandbox-url must be set")
    private String sandboxUrl;

    // KSeF live/production API base URL — legally binding invoice submissions
    @NotBlank(message = "ksef.api.production-url must be set")
    private String productionUrl;

    // SANDBOX or PRODUCTION — driven by the active Spring profile
    @NotNull(message = "ksef.api.environment must be set (SANDBOX or PRODUCTION)")
    private KsefEnvironment environment;

    // Invoice schema declared when opening an online session (defaults to FA(3)).
    @NestedConfigurationProperty
    private FormCodeProps formCode = new FormCodeProps();

    // Returns the correct base URL for the current environment
    public String getActiveBaseUrl() {
        return environment == KsefEnvironment.PRODUCTION ? productionUrl : sandboxUrl;
    }

    // Maps the configured form code to the API DTO used by POST /sessions/online.
    public FormCode toFormCode() {
        return new FormCode(formCode.getSystemCode(), formCode.getSchemaVersion(), formCode.getValue());
    }

    /** Bound from {@code ksef.api.form-code.*}; defaults match the FA(3) online-session schema. */
    @Data
    public static class FormCodeProps {
        private String systemCode = "FA (3)";
        private String schemaVersion = "1-0E";
        private String value = "FA";
    }
}
