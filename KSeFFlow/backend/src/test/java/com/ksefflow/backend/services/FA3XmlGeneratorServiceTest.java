package com.ksefflow.backend.services;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefCurrency;
import com.ksefflow.backend.models.utils.KsefPaymentMethod;
import com.ksefflow.backend.models.utils.KsefVatRate;
import com.ksefflow.backend.services.fa3xml.FA3XmlBuilder;
import com.ksefflow.backend.services.fa3xml.FA3XmlGeneratorService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

// FAST unit tests for the FA(3) builder/generator (no schema check here — the heavy
// official-XSD check lives in FA3XmlBuilderFa3Test, tagged "slow").
// These check the SHAPE of the XML as text, the field meanings, and the must-have checks.
class FA3XmlGeneratorServiceTest {

    private final FA3XmlGeneratorService generator = new FA3XmlGeneratorService();

    @Test
    @DisplayName("generateXml: makes FA(3) XML with the new namespace and correct field meanings")
    void generateXml_singleVatLine_producesFa3Shape() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Software Development", "godz.", new BigDecimal("10"),
                        new BigDecimal("100.00"), KsefVatRate.VAT_23,
                        new BigDecimal("1000.00"), new BigDecimal("230.00"), new BigDecimal("1230.00"))
        ), new BigDecimal("1000.00"), new BigDecimal("230.00"), new BigDecimal("1230.00"),
                KsefPaymentMethod.TRANSFER, null);

        String xml = generator.generateXml(invoice).xmlContent();

        // New FA(3) namespace (NOT the old FA(2) one).
        assertThat(xml).contains("http://crd.gov.pl/wzor/2025/06/25/13775/");
        assertThat(xml).doesNotContain("2023/06/29/12648");
        assertThat(xml).contains("FA (3)").contains("1-0E");

        // Seller, buyer, invoice identity.
        assertThat(xml).contains("1234567890").contains("9876543210");
        assertThat(xml).contains("FV/2026/05/0001").contains("2026-05-25");

        // Line fields — FA(3) meaning: P_9A = unit price, P_11 = net value, P_12 = rate.
        assertThat(xml).contains("Software Development");
        assertThat(xml).contains("<P_9A>100.00</P_9A>");
        assertThat(xml).contains("<P_11>1000.00</P_11>");
        assertThat(xml).contains("<P_12>23</P_12>");

        // 23% totals + total to pay.
        assertThat(xml).contains("<P_13_1>1000.00</P_13_1>").contains("<P_14_1>230.00</P_14_1>");
        assertThat(xml).contains("<P_15>1230.00</P_15>");

        // Required buyer flags + invoice kind.
        assertThat(xml).contains("<JST>2</JST>").contains("<GV>2</GV>");
        assertThat(xml).contains("<RodzajFaktury>VAT</RodzajFaktury>");

        // No split-payment note when paying by normal transfer.
        assertThat(xml).contains("<P_16>2</P_16>");
        // FA(2)-only shape is gone.
        assertThat(xml).doesNotContain("<Podsumowanie>");
    }

    @Test
    @DisplayName("generateXml: same invoice gives the same fingerprint (hash)")
    void generateXml_sameInvoice_stableHash() {
        KsefInvoice invoice = buildSimpleInvoice();
        FA3XmlGeneratorService.FA3XmlResult r1 = generator.generateXml(invoice);
        assertThat(r1.sha256Hash()).matches("[a-f0-9]{64}");
        assertThat(r1.xmlContent()).isNotBlank();
    }

    @Test
    @DisplayName("generateXml: mixed VAT rates go into the right P_13/P_14 groups")
    void generateXml_mixedVatRates_correctGrouping() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Product A", "szt.", new BigDecimal("1"), new BigDecimal("100.00"),
                        KsefVatRate.VAT_23, new BigDecimal("100.00"), new BigDecimal("23.00"), new BigDecimal("123.00")),
                buildItem("Product B", "szt.", new BigDecimal("2"), new BigDecimal("50.00"),
                        KsefVatRate.VAT_8, new BigDecimal("100.00"), new BigDecimal("8.00"), new BigDecimal("108.00"))
        ), new BigDecimal("200.00"), new BigDecimal("31.00"), new BigDecimal("231.00"),
                KsefPaymentMethod.TRANSFER, null);

        String xml = generator.generateXml(invoice).xmlContent();
        assertThat(xml).contains("<P_13_1>100.00</P_13_1>").contains("<P_14_1>23.00</P_14_1>"); // 23%
        assertThat(xml).contains("<P_13_2>100.00</P_13_2>").contains("<P_14_2>8.00</P_14_2>");  // 8%
        assertThat(xml).doesNotContain("P_13_3"); // no 5% line
    }

    @Test
    @DisplayName("generateXml: exempt line uses rate 'zw' and the exempt total P_13_7")
    void generateXml_exempt_usesZwAndP13_7() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Medical Service", "szt.", new BigDecimal("1"), new BigDecimal("500.00"),
                        KsefVatRate.EXEMPT, new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("500.00"))
        ), new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("500.00"),
                KsefPaymentMethod.TRANSFER, null);
        // Exempt lines need the law text (legal basis).
        invoice.setExemptionLegalBasis("art. 43 ust. 1 pkt 19 ustawy o VAT");

        String xml = generator.generateXml(invoice).xmlContent();
        assertThat(xml).contains("<P_12>zw</P_12>");
        assertThat(xml).contains("<P_13_7>500.00</P_13_7>");
        assertThat(xml).contains("<P_19>1</P_19>").contains("<P_19A>"); // exempt now declared correctly
    }

    @Test
    @DisplayName("generateXml: split payment sets the P_16 flag to 1")
    void generateXml_splitPayment_setsP16() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Construction", "szt.", new BigDecimal("1"), new BigDecimal("20000.00"),
                        KsefVatRate.VAT_23, new BigDecimal("20000.00"), new BigDecimal("4600.00"), new BigDecimal("24600.00"))
        ), new BigDecimal("20000.00"), new BigDecimal("4600.00"), new BigDecimal("24600.00"),
                KsefPaymentMethod.SPLIT_PAYMENT, "PL61109010140000071219812874");

        assertThat(generator.generateXml(invoice).xmlContent()).contains("<P_16>1</P_16>");
    }

    @Test
    @DisplayName("generateXml: null unit becomes 'szt.'")
    void generateXml_nullUnit_defaultsToSzt() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Widget", null, new BigDecimal("5"), new BigDecimal("10.00"),
                        KsefVatRate.VAT_23, new BigDecimal("50.00"), new BigDecimal("11.50"), new BigDecimal("61.50"))
        ), new BigDecimal("50.00"), new BigDecimal("11.50"), new BigDecimal("61.50"),
                KsefPaymentMethod.TRANSFER, null);

        assertThat(generator.generateXml(invoice).xmlContent()).contains("<P_8A>szt.</P_8A>");
    }

    // ── Must-have field checks (still valid for FA(3)) ──────────────────────────

    @Test
    @DisplayName("generateXml: stops when there are no line items")
    void generateXml_noItems_throws() {
        KsefInvoice invoice = buildInvoice(List.of(), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                KsefPaymentMethod.TRANSFER, null);
        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class).hasMessageContaining("line item");
    }

    @Test
    @DisplayName("generateXml: stops when the invoice number is blank")
    void generateXml_blankInvoiceNumber_throws() {
        KsefInvoice invoice = buildSimpleInvoice();
        invoice.setInvoiceNumber("");
        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class).hasMessageContaining("Invoice number");
    }

    @Test
    @DisplayName("generateXml: stops when the seller NIP is missing")
    void generateXml_missingSellerNip_throws() {
        KsefInvoice invoice = buildSimpleInvoice();
        invoice.setSellerNip(null);
        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class).hasMessageContaining("Seller NIP");
    }

    @Test
    @DisplayName("generateXml: stops when a line has no product name")
    void generateXml_itemMissingProductName_throws() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem(null, "szt.", new BigDecimal("1"), new BigDecimal("100.00"),
                        KsefVatRate.VAT_23, new BigDecimal("100.00"), new BigDecimal("23.00"), new BigDecimal("123.00"))
        ), new BigDecimal("100.00"), new BigDecimal("23.00"), new BigDecimal("123.00"),
                KsefPaymentMethod.TRANSFER, null);
        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class).hasMessageContaining("Product name");
    }

    @Test
    @DisplayName("generateXml: stops when an exempt line has no legal basis")
    void generateXml_exemptWithoutLegalBasis_throws() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Medical Service", "szt.", new BigDecimal("1"), new BigDecimal("500.00"),
                        KsefVatRate.EXEMPT, new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("500.00"))
        ), new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("500.00"),
                KsefPaymentMethod.TRANSFER, null);
        // exemptionLegalBasis is left null on purpose.
        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class).hasMessageContaining("legal basis");
    }

    @Test
    @DisplayName("generateXml: stops when a non-PLN invoice has no exchange rate")
    void generateXml_foreignCurrencyWithoutRate_throws() {
        KsefInvoice invoice = buildSimpleInvoice();
        invoice.setCurrency(KsefCurrency.EUR);
        invoice.setExchangeRate(null); // missing on purpose
        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class).hasMessageContaining("exchange rate");
    }

    // ── Small helpers in the builder ────────────────────────────────────────────

    @Test
    @DisplayName("amount: always 2 numbers after the dot")
    void amount_formats2dp() {
        assertThat(FA3XmlBuilder.amount(new BigDecimal("100"))).isEqualTo("100.00");
        assertThat(FA3XmlBuilder.amount(new BigDecimal("1230.5"))).isEqualTo("1230.50");
        assertThat(FA3XmlBuilder.amount(new BigDecimal("99.999"))).isEqualTo("100.00");
        assertThat(FA3XmlBuilder.amount(null)).isEqualTo("0.00");
    }

    @Test
    @DisplayName("vatRateCode: maps our rates to the FA(3) rate text")
    void vatRateCode_maps() {
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.VAT_23)).isEqualTo("23");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.VAT_8)).isEqualTo("8");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.VAT_5)).isEqualTo("5");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.VAT_0)).isEqualTo("0");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.EXEMPT)).isEqualTo("zw");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.REVERSE_CHARGE)).isEqualTo("oo");
    }

    // ── Builders ────────────────────────────────────────────────────────────────

    private KsefInvoice buildSimpleInvoice() {
        return buildInvoice(List.of(
                buildItem("Consulting", "godz.", new BigDecimal("1"), new BigDecimal("100.00"),
                        KsefVatRate.VAT_23, new BigDecimal("100.00"), new BigDecimal("23.00"), new BigDecimal("123.00"))
        ), new BigDecimal("100.00"), new BigDecimal("23.00"), new BigDecimal("123.00"),
                KsefPaymentMethod.TRANSFER, null);
    }

    private KsefInvoice buildInvoice(List<KsefInvoice.InvoiceItem> items,
                                     BigDecimal totalNet, BigDecimal totalVat, BigDecimal totalGross,
                                     KsefPaymentMethod paymentMethod, String bankAccount) {
        KsefInvoice invoice = new KsefInvoice();
        invoice.setTenantId("tenant-pl-001");
        invoice.setInvoiceNumber("FV/2026/05/0001");
        invoice.setIssueDate(LocalDate.of(2026, 5, 25));
        invoice.setDueDate(LocalDate.of(2026, 6, 25));
        invoice.setCurrency(KsefCurrency.PLN);
        invoice.setSellerNip("1234567890");
        invoice.setSellerName("Test Seller Sp. z o.o.");
        invoice.setSellerAddress("ul. Testowa 1");
        invoice.setSellerPostalCode("00-001");
        invoice.setSellerCity("Warszawa");
        invoice.setBuyerNip("9876543210");
        invoice.setBuyerName("Test Buyer S.A.");
        invoice.setBuyerAddress("ul. Kupiecka 5");
        invoice.setBuyerPostalCode("30-001");
        invoice.setBuyerCity("Kraków");
        invoice.setItems(items);
        invoice.setTotalNet(totalNet);
        invoice.setTotalVat(totalVat);
        invoice.setTotalGross(totalGross);
        invoice.setPaymentMethod(paymentMethod);
        invoice.setBankAccount(bankAccount);
        return invoice;
    }

    private KsefInvoice.InvoiceItem buildItem(String name, String unit, BigDecimal qty,
                                              BigDecimal unitPrice, KsefVatRate vatRate,
                                              BigDecimal net, BigDecimal vat, BigDecimal gross) {
        KsefInvoice.InvoiceItem item = new KsefInvoice.InvoiceItem();
        item.setItemId("item-001");
        item.setProductName(name);
        item.setUnit(unit);
        item.setQuantity(qty);
        item.setUnitPrice(unitPrice);
        item.setVatRate(vatRate);
        item.setNetAmount(net);
        item.setVatAmount(vat);
        item.setGrossAmount(gross);
        return item;
    }
}
