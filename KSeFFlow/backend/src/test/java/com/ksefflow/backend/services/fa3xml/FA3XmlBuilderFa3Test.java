package com.ksefflow.backend.services.fa3xml;

import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefCurrency;
import com.ksefflow.backend.models.utils.KsefPaymentMethod;
import com.ksefflow.backend.models.utils.KsefVatRate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Golden + regression test for the rebuilt FA(3) builder.
// It builds a real invoice, turns it into XML, and checks the XML against the OFFICIAL
// FA(3) schema. If the XML follows the rules, the builder is correct.
//
// Tagged "slow": the first FA(3) schema check builds a big rule table (a few minutes once).
// Run with:  mvn test -Pintegration-tests
@Tag("slow")
class FA3XmlBuilderFa3Test {

    private final FA3XmlGeneratorService generator = new FA3XmlGeneratorService();
    private final Fa3XsdValidator validator = new Fa3XsdValidator();

    @Test
    @DisplayName("Generated FA(3) XML passes the official FA(3) XSD")
    void generatedInvoice_passesOfficialFa3Xsd() {
        FA3XmlGeneratorService.FA3XmlResult result = generator.generateXml(sampleInvoice());

        // The big check: does our XML follow the official FA(3) rules?
        validator.validate(result.xmlContent());
        assertThat(validator.isValid(result.xmlContent())).isTrue();
    }

    @Test
    @DisplayName("Generated XML uses the FA(3) namespace and shape (no FA(2) leftovers)")
    void generatedInvoice_usesFa3ShapeNotFa2() {
        String xml = generator.generateXml(sampleInvoice()).xmlContent();

        // Uses the new FA(3) namespace, not the old FA(2) one.
        assertThat(xml).contains("http://crd.gov.pl/wzor/2025/06/25/13775/");
        assertThat(xml).doesNotContain("2023/06/29/12648"); // old FA(2) namespace must be gone

        // Has the required FA(3) parts.
        assertThat(xml).contains("<Naglowek>").contains("<Podmiot1>").contains("<Podmiot2>").contains("<Fa>");
        assertThat(xml).contains("<JST>").contains("<GV>");            // required buyer flags
        assertThat(xml).contains("<P_13_1>").contains("<P_14_1>");     // 23% totals
        assertThat(xml).contains("<P_13_2>").contains("<P_14_2>");     // 8% totals (we have an 8% line)
        assertThat(xml).contains("<RodzajFaktury>VAT</RodzajFaktury>");

        // FA(2)-only shape must be gone.
        assertThat(xml).doesNotContain("<Podsumowanie>");
    }

    // A normal invoice with one 23% line and one 8% line.
    private static KsefInvoice sampleInvoice() {
        KsefInvoice.InvoiceItem line1 = new KsefInvoice.InvoiceItem();
        line1.setProductName("Compliance Consulting");
        line1.setUnit("szt.");
        line1.setQuantity(new BigDecimal("1"));
        line1.setUnitPrice(new BigDecimal("1000.00"));
        line1.setVatRate(KsefVatRate.VAT_23);
        line1.setNetAmount(new BigDecimal("1000.00"));
        line1.setVatAmount(new BigDecimal("230.00"));
        line1.setGrossAmount(new BigDecimal("1230.00"));

        KsefInvoice.InvoiceItem line2 = new KsefInvoice.InvoiceItem();
        line2.setProductName("Printed Manual");
        line2.setUnit("szt.");
        line2.setQuantity(new BigDecimal("2"));
        line2.setUnitPrice(new BigDecimal("50.00"));
        line2.setVatRate(KsefVatRate.VAT_8);
        line2.setNetAmount(new BigDecimal("100.00"));
        line2.setVatAmount(new BigDecimal("8.00"));
        line2.setGrossAmount(new BigDecimal("108.00"));

        KsefInvoice inv = new KsefInvoice();
        inv.setInvoiceNumber("FV/2026/06/0001");
        inv.setIssueDate(LocalDate.of(2026, 6, 4));
        inv.setDueDate(LocalDate.of(2026, 6, 18));
        inv.setSellerName("DSV TEAM Sp. z o.o.");
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
        inv.setTotalNet(new BigDecimal("1100.00"));
        inv.setTotalVat(new BigDecimal("238.00"));
        inv.setTotalGross(new BigDecimal("1338.00"));
        inv.setPaymentMethod(KsefPaymentMethod.TRANSFER);
        inv.setItems(List.of(line1, line2));
        return inv;
    }
}
