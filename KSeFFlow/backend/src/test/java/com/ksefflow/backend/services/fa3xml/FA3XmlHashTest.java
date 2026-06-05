package com.ksefflow.backend.services.fa3xml;

import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefCurrency;
import com.ksefflow.backend.models.utils.KsefPaymentMethod;
import com.ksefflow.backend.models.utils.KsefVatRate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Proves the invoice "fingerprint" (SHA-256) is taken from the EXACT XML text that
// gets sent to KSeF — so the hash in the QR code and audit trail always matches the
// real document.
class FA3XmlHashTest {

    private final FA3XmlGeneratorService generator = new FA3XmlGeneratorService();

    @Test
    @DisplayName("sha256Hex uses standard SHA-256 over UTF-8 bytes (known vector)")
    void sha256Hex_knownVector() {
        // The SHA-256 of the text "test" is a well-known fixed value.
        assertThat(FA3XmlGeneratorService.sha256Hex("test"))
                .isEqualTo("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
    }

    @Test
    @DisplayName("generateXml: stored hash == SHA-256 of the exact returned XML bytes")
    void hashMatchesExactXmlBytes() throws Exception {
        FA3XmlGeneratorService.FA3XmlResult result = generator.generateXml(sampleInvoice());

        // 1) The hash equals our own hash of the SAME xml string the service returns
        //    (and that same string is what KSeFInvoiceService submits to KSeF).
        assertThat(result.sha256Hash())
                .isEqualTo(FA3XmlGeneratorService.sha256Hex(result.xmlContent()));

        // 2) Cross-check with an INDEPENDENT SHA-256 computation over the UTF-8 bytes.
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(result.xmlContent().getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte b : digest) hex.append(String.format("%02x", b));

        assertThat(result.sha256Hash()).isEqualTo(hex.toString());
        assertThat(result.sha256Hash()).hasSize(64); // SHA-256 hex = 64 chars
    }

    // A complete, valid invoice the FA XML builder accepts (NIPs are 10 digits and the
    // totals are internally consistent so business-rule validation passes).
    private static KsefInvoice sampleInvoice() {
        KsefInvoice.InvoiceItem item = new KsefInvoice.InvoiceItem();
        item.setItemId("i1");
        item.setProductName("Usługa testowa");
        item.setUnit("szt.");
        item.setQuantity(new BigDecimal("1"));
        item.setUnitPrice(new BigDecimal("100.00"));
        item.setVatRate(KsefVatRate.VAT_23);
        item.setNetAmount(new BigDecimal("100.00"));
        item.setVatAmount(new BigDecimal("23.00"));
        item.setGrossAmount(new BigDecimal("123.00"));

        KsefInvoice inv = new KsefInvoice();
        inv.setInvoiceNumber("FV/2026/06/0001");
        inv.setIssueDate(LocalDate.of(2026, 6, 4));
        inv.setDueDate(LocalDate.of(2026, 6, 18));
        inv.setSellerName("DSV TEAM");
        inv.setSellerNip("7410852096");
        inv.setSellerAddress("High Street 1");
        inv.setSellerPostalCode("00-001");
        inv.setSellerCity("Warszawa");
        inv.setBuyerName("Central Trade Poland Sp. z o.o.");
        inv.setBuyerNip("5229983144");
        inv.setBuyerAddress("Al. Jerozolimskie 22");
        inv.setBuyerPostalCode("00-345");
        inv.setBuyerCity("Warszawa");
        inv.setCurrency(KsefCurrency.PLN);
        inv.setTotalNet(new BigDecimal("100.00"));
        inv.setTotalVat(new BigDecimal("23.00"));
        inv.setTotalGross(new BigDecimal("123.00"));
        inv.setPaymentMethod(KsefPaymentMethod.TRANSFER);
        inv.setItems(List.of(item));
        return inv;
    }
}
