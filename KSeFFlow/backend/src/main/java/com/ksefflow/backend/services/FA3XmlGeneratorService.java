package com.ksefflow.backend.services;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.services.fa3xmlutils.FA3XmlBuilder;
import com.ksefflow.backend.services.fa3xmlutils.FA3XmlSerializer;
import com.ksefflow.backend.services.fa3xmlutils.FA3XmlValidator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * FA(3) XML Generator — Phase 3 of the KSeFFlow invoice pipeline.
 *
 * Converts a KsefInvoice (stored in MongoDB) into a ready-to-submit FA(3) XML
 * document as required by the Polish KSeF government e-invoice API.
 *
 * Pipeline:
 *   1. Pre-flight guard — validates required fields are present (no partial invoice)
 *   2. Build — FA3XmlBuilder converts the invoice into a DOM Document
 *   3. Serialize — FA3XmlSerializer transforms DOM → UTF-8 XML string
 *   4. Validate — FA3XmlValidator checks structure + business rules (NIP format, P_15 consistency)
 *   5. Hash — SHA-256 of the final XML bytes stored for tamper-evidence audit
 *
 * Returns FA3XmlResult which the caller (KSeFInvoiceService in Phase 4) uses to:
 *   - submit the xmlContent to the KSeF government API
 *   - store the sha256Hash in the KsefInvoice.fa3XmlHash field for audit tracing
 *
 * Compliance: generated XML conforms to FA(3) schema (namespace http://crd.gov.pl/wzor/2023/06/29/12648/)
 * as required by the Polish VAT Act and Ministerstwo Finansów KSeF specification.
 */
@Service
@Slf4j
public class FA3XmlGeneratorService {

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Generates a validated FA(3) XML document from the given invoice.
     *
     * @param invoice  fully populated KsefInvoice — all required fields must be non-null
     * @return FA3XmlResult containing the XML string and its SHA-256 hash
     * @throws KsefXmlGenerationException if the invoice is incomplete or the generated XML is invalid
     */
    public FA3XmlResult generateXml(KsefInvoice invoice) {
        log.debug("Generating FA(3) XML for invoice [{}] tenant [{}]",
                invoice.getInvoiceNumber(), invoice.getTenantId());

        // Step 1: Build DOM — also runs pre-flight field validation inside FA3XmlBuilder
        Document doc = FA3XmlBuilder.build(invoice);

        // Step 2: Serialize DOM → UTF-8 XML string
        String xml = FA3XmlSerializer.serialize(doc);

        // Step 3: Validate structure and business rules
        // Strict=false in dev: XSD warning is logged but does not block.
        // Phase 4 (KSeFInvoiceService) will call validate(xml, true) before production submission.
        FA3XmlValidator.validate(xml);

        // Step 4: SHA-256 hash for tamper-evidence audit trail
        String hash = sha256Hex(xml);

        log.info("FA(3) XML generated successfully for invoice [{}] — SHA-256: [{}]",
                invoice.getInvoiceNumber(), hash);

        return new FA3XmlResult(xml, hash);
    }

    // ── Result type ────────────────────────────────────────────────────────────

    // Immutable value object — caller assigns xml to KSeF API body, hash to invoice.fa3XmlHash.
    // Java record: zero boilerplate, canonical constructor, auto-generated accessors.
    public record FA3XmlResult(String xmlContent, String sha256Hash) {}

    // ── SHA-256 helper ─────────────────────────────────────────────────────────

    private static String sha256Hex(String xml) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(xml.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hashBytes.length * 2);
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed by the Java spec — this cannot happen
            throw new KsefXmlGenerationException("SHA-256 algorithm not available", e);
        }
    }
}
