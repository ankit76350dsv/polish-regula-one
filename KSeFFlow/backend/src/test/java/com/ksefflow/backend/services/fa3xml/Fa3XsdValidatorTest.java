package com.ksefflow.backend.services.fa3xml;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Tests for the official FA(3) checker.
// The "good" invoice is an OFFICIAL sample from the government's own Java client
// (ksef-client-java), with only its placeholder tokens filled in with valid values.
// We do NOT hand-write the invoice shape — we only prove the checker works.
//
// Tagged "slow": the first real FA(3) check builds a big rule table (a few minutes once),
// so these run only in the integration profile (mvn verify -Pintegration-tests), not in
// the fast unit test run (mvn test).
@Tag("slow")
class Fa3XsdValidatorTest {

    // Build the checker once (it loads the real FA(3) schema from local files).
    private static Fa3XsdValidator validator;
    private static String validInvoiceXml;

    @BeforeAll
    static void setUp() throws Exception {
        validator = new Fa3XsdValidator();
        validInvoiceXml = readResource("/fa3-samples/invoice-valid-fa3.xml");
    }

    @Test
    @DisplayName("Schema loads from local files only (offline) — checker is ready")
    void schemaLoadsOffline() {
        // If the constructor above worked, the official schema + its 3 imported files
        // were all found locally and joined together with no internet call.
        assertThat(validator).isNotNull();
    }

    @Test
    @DisplayName("A real official FA(3) invoice passes the check")
    void officialInvoice_isValid() {
        // The good invoice must pass with no error.
        validator.validate(validInvoiceXml);
        assertThat(validator.isValid(validInvoiceXml)).isTrue();
    }

    @Test
    @DisplayName("Wrong namespace (FA(2)) is rejected")
    void wrongNamespace_fails() {
        // Swap the FA(3) namespace for the old FA(2) one — must be rejected.
        String fa2 = validInvoiceXml.replace(
                "http://crd.gov.pl/wzor/2025/06/25/13775/",
                "http://crd.gov.pl/wzor/2023/06/29/12648/");

        assertThatThrownBy(() -> validator.validate(fa2))
                .isInstanceOf(KsefXmlGenerationException.class)
                .hasMessageContaining("not valid");
    }

    @Test
    @DisplayName("Missing a required field (KodWaluty) is rejected")
    void missingRequiredField_fails() {
        // Remove a required field. The check must stop with an error.
        String broken = validInvoiceXml.replaceFirst("<KodWaluty>PLN</KodWaluty>", "");

        assertThat(validator.isValid(broken)).isFalse();
        assertThatThrownBy(() -> validator.validate(broken))
                .isInstanceOf(KsefXmlGenerationException.class);
    }

    @Test
    @DisplayName("A tag that is not in the schema is rejected")
    void unknownElement_fails() {
        String bogus = "<Faktura xmlns=\"http://crd.gov.pl/wzor/2025/06/25/13775/\">"
                + "<ThisTagDoesNotExist/></Faktura>";

        assertThatThrownBy(() -> validator.validate(bogus))
                .isInstanceOf(KsefXmlGenerationException.class);
    }

    @Test
    @DisplayName("Empty XML is rejected")
    void emptyXml_fails() {
        assertThatThrownBy(() -> validator.validate("  "))
                .isInstanceOf(KsefXmlGenerationException.class)
                .hasMessageContaining("empty");
    }

    private static String readResource(String path) throws Exception {
        try (InputStream is = Fa3XsdValidatorTest.class.getResourceAsStream(path)) {
            if (is == null) throw new IllegalStateException("Missing test resource: " + path);
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
