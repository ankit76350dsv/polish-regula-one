package com.ksefflow.backend.services.fa3xml;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.xml.sax.SAXException;

import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import javax.xml.validation.Validator;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

// SIMPLE EXPLANATION:
// This class checks if an invoice XML follows the official government FA(3) rules.
// It loads the real FA(3) schema from local files (no internet).
// If the XML breaks any rule — a missing field, a wrong tag, or the wrong namespace —
// it stops right away and throws an error. Nothing bad slips through.
//
// IMPORTANT: this is only the CHECKER. It does not build invoices. The invoice builder
// will be changed in a later step and will use this checker to prove its output is correct.
@Slf4j
@Component
public class Fa3XsdValidator {

    // The main official FA(3) schema file saved inside the app.
    private static final String FA3_MAIN_XSD = "/xsd/fa3/schemat.xsd";

    static {
        // SIMPLE EXPLANATION: the official FA(3) schema is very big. Java has a safety
        // cap that says "a list cannot repeat more than 5000 times" and the FA(3) schema
        // allows up to 50000 (for example correction lines). This is the real government
        // file we ship ourselves, so we raise the cap to just above what the schema needs.
        // We use a real number (not "0"/unlimited) so the check stays fast and safe.
        System.setProperty("jdk.xml.maxOccurLimit", "60000");
    }

    // We build the schema object only once because building it is slow.
    // A built Schema is safe to share between many requests.
    private final Schema fa3Schema;

    public Fa3XsdValidator() {
        this.fa3Schema = loadFa3Schema();
        log.info("[Fa3XsdValidator]:1 Official FA(3) schema loaded from {} (offline)", FA3_MAIN_XSD);
    }

    //! Build the FA(3) schema using ONLY local files.
    //TODO: this file KSeFFlow/backend/src/main/resources/xsd/fa3/schemat.xsd
    private Schema loadFa3Schema() {
        try (InputStream mainXsd = getClass().getResourceAsStream(FA3_MAIN_XSD)) {
            if (mainXsd == null) {
                throw new KsefXmlGenerationException("FA(3) schema file not found in the app: " + FA3_MAIN_XSD);
            }
            SchemaFactory factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
            // Turn on safe mode (blocks risky outside access).
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            // When the schema wants an imported file, give it our local copy, not the internet.
            factory.setResourceResolver(new Fa3SchemaResourceResolver());

            StreamSource source = new StreamSource(mainXsd);
            // Tell the reader the file name so imports can be matched correctly.
            source.setSystemId(FA3_MAIN_XSD);
            return factory.newSchema(source);
        } catch (SAXException | IOException e) {
            // If the schema itself cannot be built, the app must not start pretending it can validate.
            throw new KsefXmlGenerationException("Could not load the FA(3) schema: " + e.getMessage(), e);
        }
    }

    //! Automatic before this will runloadFa3Schema
    //! Check one invoice XML against the FA(3) rules.
    // If the XML is good, this method returns quietly.
    // If the XML is bad, it throws KsefXmlGenerationException with the reason.
    public void validate(String xml) {
        if (xml == null || xml.isBlank()) {
            throw new KsefXmlGenerationException("FA(3) validation failed: the XML is empty");
        }
        try {
            // Make a fresh checker each time. A Validator object cannot be shared safely.
            Validator validator = fa3Schema.newValidator();
            // Do not let the XML pull any files from outside (safety).
            validator.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            validator.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");

            validator.validate(new StreamSource(
                    new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))));

            log.debug("[validate]:1 XML passed the FA(3) check");
        } catch (SAXException e) {
            // The XML broke an FA(3) rule. Stop and say why.
            throw new KsefXmlGenerationException("FA(3) XML is not valid: " + e.getMessage(), e);
        } catch (IOException e) {
            throw new KsefXmlGenerationException("Could not read the XML for the FA(3) check: " + e.getMessage(), e);
        }
    }

    // Warm up the checker by checking one bundled sample invoice once.
    // SIMPLE EXPLANATION: the first check builds a big rule table and is slow. Running it
    // once here (in the background at start-up) means real invoices are always fast after.
    public void warmUp() {
        try (InputStream sample = getClass().getResourceAsStream("/xsd/fa3/warmup-invoice.xml")) {
            if (sample == null) {
                log.warn("[warmUp]:1 Warm-up sample not found — skipping warm-up");
                return;
            }
            validate(new String(sample.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            log.warn("[warmUp]:2 Warm-up could not read the sample: {}", e.getMessage());
        }
    }

    // A safe helper for places that only want a yes/no answer (no exception).
    public boolean isValid(String xml) {
        try {
            validate(xml);
            return true;
        } catch (KsefXmlGenerationException e) {
            return false;
        }
    }
}
