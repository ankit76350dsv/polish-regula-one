package com.ksefflow.backend.services.fa3xml;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import com.ksefflow.backend.models.KsefInvoice;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

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
 *   4. Validate — the official FA(3) XSD check runs in Fa3ValidationGate before submission
 *      (only when ksef.validation.xsd.enabled=true); KSeF also validates server-side
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

    // Timestamp suffix for dumped XML filenames (e.g. 20260602_153045_123).
    private static final DateTimeFormatter DUMP_TS = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS");

    // Debug aid: when enabled, every generated FA(3) XML is written to a local
    // folder for inspection/audit-tracing. Disabled by default — MUST stay off in
    // production (data-residency/storage rules require S3, not the local disk).
    @Value("${ksef.xml.dump.enabled:false}")
    private boolean xmlDumpEnabled;

    @Value("${ksef.xml.dump.dir:./generated-xml}")
    private String xmlDumpDir;

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Generates a validated FA(3) XML document from the given invoice.
     *
     * @param invoice  fully populated KsefInvoice — all required fields must be non-null
     * @return FA3XmlResult containing the XML string and its SHA-256 hash
     * @throws KsefXmlGenerationException if the invoice is incomplete or the generated XML is invalid
     */
    public FA3XmlResult generateXml(KsefInvoice invoice) {
        log.debug("[GenerateXml] Generating: FA(3) XML for invoice [{}] tenant [{}]", invoice.getInvoiceNumber(), invoice.getTenantId());

        // Step 1: Build DOM — also runs pre-flight field validation inside FA3XmlBuilder
        Document doc = FA3XmlBuilder.build(invoice); 

        //! Step 2: Serialize DOM → UTF-8 XML string
        String xml = FA3XmlSerializer.serialize(doc);

        //TODO: in future comment this...
        // Step 2b (optional, debug): save the made XML to a local file so we can read it.
        dumpXmlToFile(invoice, xml);

        // NOTE: we do NOT run the old FA(2) check here anymore. The official FA(3) schema
        // check now happens in Fa3ValidationGate before submission (only when turned on),
        // and KSeF always checks the invoice on its side. Must-have fields were already
        // checked inside FA3XmlBuilder.build().

        // Step 3: make the tamper-proof fingerprint (SHA-256) of the exact XML we will send.
        String hash = sha256Hex(xml);

        log.info("[GenerateXml] Generated: FA(3) XML successfully for invoice [{}] — SHA-256: [{}]", invoice.getInvoiceNumber(), hash);

        return new FA3XmlResult(xml, hash);
    }

    //! ── Result type ────────────────────────────────────────────────────────────

    // Immutable value object — caller assigns xml to KSeF API body, hash to invoice.fa3XmlHash.
    // Java record: zero boilerplate, canonical constructor, auto-generated accessors.
    public record FA3XmlResult(String xmlContent, String sha256Hash) {}

    // TODO in future you can remove it: ── Local XML dump (debug aid) ───────────────────────────────────────────────

    // Writes the generated XML to a timestamped file under ksef.xml.dump.dir when
    // ksef.xml.dump.enabled=true. A failure here NEVER breaks generation — it only
    // logs a warning, since this is purely a debugging/inspection convenience.
    private void dumpXmlToFile(KsefInvoice invoice, String xml) {
        if (!xmlDumpEnabled) {
            return;
        }
        try {
            Path dir = Path.of(xmlDumpDir);
            Files.createDirectories(dir);

            // Filename: <invoiceNumber>_<timestamp>.xml — sanitised so the FA(3)
            // number's slashes (FV/2026/05/0001) can't create sub-dirs or escape the folder.
            String safeNumber = invoice.getInvoiceNumber() == null
                    ? "unknown"
                    : invoice.getInvoiceNumber().replaceAll("[^a-zA-Z0-9._-]", "_");
            String fileName = safeNumber + "_" + LocalDateTime.now().format(DUMP_TS) + ".xml";

            Path file = dir.resolve(fileName);
            Files.writeString(file, xml, StandardCharsets.UTF_8);

            log.info("[DumpXmlToFile] Dumped FA(3) XML to [{}]", file.toAbsolutePath());
        } catch (IOException | RuntimeException e) {
            log.warn("[DumpXmlToFile] Could not dump FA(3) XML to disk (dir=[{}]): {}",
                    xmlDumpDir, e.getMessage());
        }
    }

    //! ── SHA-256 helper ─────────────────────────────────────────────────────────

    // SIMPLE EXPLANATION: this makes a unique "fingerprint" of the invoice XML. We
    // fingerprint the EXACT same text that we send to KSeF, so the fingerprint always
    // matches the real document. If even one character changes, the fingerprint changes.
    // Package-private so the hash test can check it directly.
    static String sha256Hex(String xml) {
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
