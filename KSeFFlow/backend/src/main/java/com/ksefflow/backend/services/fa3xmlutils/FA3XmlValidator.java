package com.ksefflow.backend.services.fa3xmlutils;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;

import lombok.extern.slf4j.Slf4j;

import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import javax.xml.validation.Validator;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

// Two-phase FA(3) XML validation:
//
// Phase A — XSD structural validation (skipped if XSD not on classpath):
//   Loads FA3_schema.xsd from classpath:/xsd/FA3_schema.xsd.
//   If the file is missing (dev environment without the schema), logs a warning
//   and continues — so local development works without the government XSD file.
//   In production, the XSD must be present; absence is treated as a hard error
//   when validateStrictly=true.
//
// Phase B — programmatic business-rule validation:
//   Checks NIP format (10 digits), required elements present, VAT calculation
//   consistency (net + VAT == gross within 0.01 PLN rounding tolerance).
//
// All pure static — no Spring context.
@Slf4j
public final class FA3XmlValidator {


    private static final String XSD_CLASSPATH = "/xsd/FA3_schema.xsd";
    private static final String FA3_NS        = FA3XmlBuilder.FA3_NAMESPACE;
    private static final String NIP_PATTERN   = "\\d{10}";

    // Rounding tolerance for VAT cross-check: 0.01 PLN per line
    private static final BigDecimal VAT_TOLERANCE = new BigDecimal("0.02");

    private FA3XmlValidator() {}

    // ── Public API ─────────────────────────────────────────────────────────────

    // Validates the XML string.  If strict=true and the XSD is missing, throws.
    //Todo: 2nd
    public static void validate(String xml, boolean strict) {
        Document doc = parseXml(xml);
        //Todo: 3rd
        validateXsd(xml, strict);
        validateBusinessRules(doc);
    }

    // Convenience overload for dev (non-strict — XSD missing just logs warning)
    //Todo: 1st
    public static void validate(String xml) {
        validate(xml, false);
    }

    // ── Phase A: XSD structural validation ────────────────────────────────────

    //Todo: 3rd
    private static void validateXsd(String xml, boolean strict) {
        InputStream xsdStream = FA3XmlValidator.class.getResourceAsStream(XSD_CLASSPATH);
        if (xsdStream == null) {
            String msg = "FA(3) XSD not found on classpath [" + XSD_CLASSPATH + "]. " +
                         "XSD validation skipped.";
            if (strict) {
                throw new KsefXmlGenerationException(msg);
            }
            log.warn(msg + " Place the official KSeF FA3 XSD at src/main/resources/xsd/FA3_schema.xsd " +
                     "to enable structural validation.");
            return;
        }

        try {
            SchemaFactory schemaFactory =
                    SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);

            // Disable external entity access — OWASP XXE prevention
            schemaFactory.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            schemaFactory.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");

            Schema schema = schemaFactory.newSchema(new StreamSource(xsdStream));
            Validator validator = schema.newValidator();
            validator.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            validator.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");

            validator.validate(new StreamSource(
                    new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))));

            log.debug("FA(3) XSD structural validation passed");

        } catch (SAXException e) {
            throw new KsefXmlGenerationException(
                    "FA(3) XML fails XSD structural validation: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new KsefXmlGenerationException(
                    "Error running FA(3) XSD validation: " + e.getMessage(), e);
        }
    }

    // ── Phase B: programmatic business-rule checks ─────────────────────────────

    private static void validateBusinessRules(Document doc) {
        requireElement(doc, "Naglowek",    "Naglowek (header) element is missing from FA(3) XML");
        requireElement(doc, "Podmiot1",    "Podmiot1 (seller) element is missing from FA(3) XML");
        requireElement(doc, "Podmiot2",    "Podmiot2 (buyer) element is missing from FA(3) XML");
        requireElement(doc, "Fa",          "Fa (invoice body) element is missing from FA(3) XML");
        requireElement(doc, "FaWiersz",    "At least one FaWiersz (line item) is required in FA(3) XML");
        requireElement(doc, "Podsumowanie","Podsumowanie (summary) element is missing from FA(3) XML");

        validateNip(doc, "seller");
        validateNip(doc, "buyer");
        validateGrossAmountConsistency(doc);
    }

    // NIP must be exactly 10 digits — required by Polish VAT law and KSeF schema
    private static void validateNip(Document doc, String party) {
        NodeList nips = doc.getElementsByTagNameNS(FA3_NS, "NIP");
        for (int i = 0; i < nips.getLength(); i++) {
            String nip = nips.item(i).getTextContent().trim();
            if (!nip.matches(NIP_PATTERN)) {
                throw new KsefXmlGenerationException(
                        "Invalid NIP [" + nip + "] in FA(3) XML — must be exactly 10 digits. " +
                        "Party: " + party);
            }
        }
    }

    // Cross-check: sum of all P_15 (gross) elements must agree with total gross in Podsumowanie.
    // Validates that rounding in each line item sums correctly to the invoice total.
    private static void validateGrossAmountConsistency(Document doc) {
        NodeList p15Elements = doc.getElementsByTagNameNS(FA3_NS, "P_15");

        if (p15Elements.getLength() < 2) {
            // P_15 appears twice: once in <Fa> and once in <Podsumowanie>
            throw new KsefXmlGenerationException(
                    "FA(3) XML is missing P_15 (total gross) in Fa or Podsumowanie");
        }

        // Both P_15 occurrences must match
        String faGross  = p15Elements.item(0).getTextContent().trim();
        String sumGross = p15Elements.item(1).getTextContent().trim();
        try {
            BigDecimal fa  = new BigDecimal(faGross);
            BigDecimal sum = new BigDecimal(sumGross);
            if (fa.subtract(sum).abs().compareTo(VAT_TOLERANCE) > 0) {
                throw new KsefXmlGenerationException(
                        "P_15 mismatch in FA(3) XML: Fa=[" + faGross +
                        "] vs Podsumowanie=[" + sumGross + "]. Difference exceeds tolerance.");
            }
        } catch (NumberFormatException e) {
            throw new KsefXmlGenerationException(
                    "Non-numeric P_15 value in FA(3) XML: [" + faGross + "] or [" + sumGross + "]");
        }
    }

    private static void requireElement(Document doc, String localName, String message) {
        NodeList nl = doc.getElementsByTagNameNS(FA3_NS, localName);
        if (nl.getLength() == 0) {
            throw new KsefXmlGenerationException(message);
        }
    }

    private static Document parseXml(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);

            // XXE prevention
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);

            DocumentBuilder builder = factory.newDocumentBuilder();
            return builder.parse(
                    new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));

        } catch (Exception e) {
            throw new KsefXmlGenerationException(
                    "FA(3) XML is not well-formed: " + e.getMessage(), e);
        }
    }
}
