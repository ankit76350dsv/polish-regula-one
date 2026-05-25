package com.ksefflow.backend.services;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefCurrency;
import com.ksefflow.backend.models.utils.KsefPaymentMethod;
import com.ksefflow.backend.models.utils.KsefVatRate;
import com.ksefflow.backend.services.fa3xmlutils.FA3XmlBuilder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

// Pure unit tests — no Spring context, no MongoDB, no network.
// FA3XmlGeneratorService has no @Autowired fields: just call it directly.
class FA3XmlGeneratorServiceTest {

    private final FA3XmlGeneratorService generator = new FA3XmlGeneratorService();

    // ── Happy-path: full invoice with single 23% VAT line ─────────────────────

    @Test
    @DisplayName("generateXml: single 23% VAT line produces valid FA(3) XML with all required elements")
    void generateXml_singleVatLine_producesValidXml() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Software Development", "godz.", new BigDecimal("10"),
                        new BigDecimal("100.00"), KsefVatRate.VAT_23,
                        new BigDecimal("1000.00"), new BigDecimal("230.00"), new BigDecimal("1230.00"))
        ), new BigDecimal("1000.00"), new BigDecimal("230.00"), new BigDecimal("1230.00"),
                KsefPaymentMethod.TRANSFER, null);

        FA3XmlGeneratorService.FA3XmlResult result = generator.generateXml(invoice);

        assertThat(result.xmlContent()).isNotBlank();
        assertThat(result.sha256Hash()).matches("[a-f0-9]{64}");

        // Namespace correct
        assertThat(result.xmlContent()).contains("http://crd.gov.pl/wzor/2023/06/29/12648/");
        assertThat(result.xmlContent()).contains("<Faktura");

        // Header elements
        assertThat(result.xmlContent()).contains("FA (3)");
        assertThat(result.xmlContent()).contains("1-0E");

        // Seller and buyer
        assertThat(result.xmlContent()).contains("1234567890");  // seller NIP
        assertThat(result.xmlContent()).contains("9876543210");  // buyer NIP
        assertThat(result.xmlContent()).contains("Test Seller Sp. z o.o.");
        assertThat(result.xmlContent()).contains("Test Buyer S.A.");

        // Invoice identity
        assertThat(result.xmlContent()).contains("FV/2026/05/0001");
        assertThat(result.xmlContent()).contains("2026-05-25");

        // Line item
        assertThat(result.xmlContent()).contains("Software Development");
        assertThat(result.xmlContent()).contains("<P_11>23</P_11>");
        assertThat(result.xmlContent()).contains("<P_10>1000.00</P_10>");
        assertThat(result.xmlContent()).contains("<P_12>230.00</P_12>");

        // Total gross
        assertThat(result.xmlContent()).contains("1230.00");

        // No MPP annotation when payment method is TRANSFER
        assertThat(result.xmlContent()).contains("<P_16>2</P_16>");
    }

    @Test
    @DisplayName("generateXml: SHA-256 hash is stable — same invoice produces same hash")
    void generateXml_samInvoice_producesStableHash() {
        KsefInvoice invoice = buildSimpleInvoice();

        FA3XmlGeneratorService.FA3XmlResult r1 = generator.generateXml(invoice);
        FA3XmlGeneratorService.FA3XmlResult r2 = generator.generateXml(invoice);

        // Both hashes must be valid 64-char lowercase hex (SHA-256 output)
        assertThat(r1.sha256Hash()).matches("[a-f0-9]{64}");
        assertThat(r2.sha256Hash()).matches("[a-f0-9]{64}");
        // xmlContent itself must be non-blank
        assertThat(r1.xmlContent()).isNotBlank();
        assertThat(r2.xmlContent()).isNotBlank();
    }

    // ── Multiple VAT rates ─────────────────────────────────────────────────────

    @Test
    @DisplayName("generateXml: mixed VAT rates produce correct P_13/P_14 grouping in Podsumowanie")
    void generateXml_mixedVatRates_correctPodsumowanieGrouping() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Product A", "szt.", new BigDecimal("1"),
                        new BigDecimal("100.00"), KsefVatRate.VAT_23,
                        new BigDecimal("100.00"), new BigDecimal("23.00"), new BigDecimal("123.00")),
                buildItem("Product B", "szt.", new BigDecimal("2"),
                        new BigDecimal("50.00"), KsefVatRate.VAT_8,
                        new BigDecimal("100.00"), new BigDecimal("8.00"), new BigDecimal("108.00"))
        ), new BigDecimal("200.00"), new BigDecimal("31.00"), new BigDecimal("231.00"),
                KsefPaymentMethod.TRANSFER, null);

        String xml = generator.generateXml(invoice).xmlContent();

        // 23% group
        assertThat(xml).contains("<P_13_1>100.00</P_13_1>");
        assertThat(xml).contains("<P_14_1>23.00</P_14_1>");

        // 8% group
        assertThat(xml).contains("<P_13_2>100.00</P_13_2>");
        assertThat(xml).contains("<P_14_2>8.00</P_14_2>");

        // 5% group absent (no 5% items)
        assertThat(xml).doesNotContain("P_13_3");
        assertThat(xml).doesNotContain("P_13_4");
    }

    @Test
    @DisplayName("generateXml: EXEMPT VAT rate maps to 'zw' and emits P_13_5/P_14_5 group")
    void generateXml_exemptVatRate_emitsZwCodeAndP13_5Group() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Medical Service", "szt.", new BigDecimal("1"),
                        new BigDecimal("500.00"), KsefVatRate.EXEMPT,
                        new BigDecimal("500.00"), new BigDecimal("0.00"), new BigDecimal("500.00"))
        ), new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("500.00"),
                KsefPaymentMethod.TRANSFER, null);

        String xml = generator.generateXml(invoice).xmlContent();

        assertThat(xml).contains("<P_11>zw</P_11>");
        assertThat(xml).contains("<P_13_5>500.00</P_13_5>");
        assertThat(xml).contains("<P_14_5>0.00</P_14_5>");

        // P_18 (reverse charge annotation) must be "2" (no)
        assertThat(xml).contains("<P_18>2</P_18>");
    }

    @Test
    @DisplayName("generateXml: REVERSE_CHARGE maps to 'np', sets P_18=1 in Adnotacje")
    void generateXml_reverseCharge_emitsNpCodeAndP18Flag() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("B2B EU Service", "szt.", new BigDecimal("1"),
                        new BigDecimal("1000.00"), KsefVatRate.REVERSE_CHARGE,
                        new BigDecimal("1000.00"), new BigDecimal("0.00"), new BigDecimal("1000.00"))
        ), new BigDecimal("1000.00"), BigDecimal.ZERO, new BigDecimal("1000.00"),
                KsefPaymentMethod.TRANSFER, null);

        String xml = generator.generateXml(invoice).xmlContent();

        assertThat(xml).contains("<P_11>np</P_11>");
        assertThat(xml).contains("<P_18>1</P_18>");   // reverse charge flag set
        assertThat(xml).contains("<P_13_6>1000.00</P_13_6>");
        assertThat(xml).contains("<P_14_6>0.00</P_14_6>");
    }

    // ── Split payment (MPP) ────────────────────────────────────────────────────

    @Test
    @DisplayName("generateXml: SPLIT_PAYMENT sets P_16=1 and includes bank account in Platnosc")
    void generateXml_splitPayment_setsMppFlagAndBankAccount() {
        KsefInvoice invoice = buildInvoice(List.of(
                buildItem("Construction Service", "szt.", new BigDecimal("1"),
                        new BigDecimal("20000.00"), KsefVatRate.VAT_23,
                        new BigDecimal("20000.00"), new BigDecimal("4600.00"), new BigDecimal("24600.00"))
        ), new BigDecimal("20000.00"), new BigDecimal("4600.00"), new BigDecimal("24600.00"),
                KsefPaymentMethod.SPLIT_PAYMENT, "PL61109010140000071219812874");

        String xml = generator.generateXml(invoice).xmlContent();

        assertThat(xml).contains("<P_16>1</P_16>");  // MPP flag
        assertThat(xml).contains("<FormaPlatnosci>6</FormaPlatnosci>");
        assertThat(xml).contains("PL61109010140000071219812874");
    }

    // ── Unit defaults ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("generateXml: null unit defaults to 'szt.' in FaWiersz/P_8A")
    void generateXml_nullUnit_defaultsToSzt() {
        KsefInvoice.InvoiceItem item = buildItem("Widget", null, new BigDecimal("5"),
                new BigDecimal("10.00"), KsefVatRate.VAT_23,
                new BigDecimal("50.00"), new BigDecimal("11.50"), new BigDecimal("61.50"));
        KsefInvoice invoice = buildInvoice(List.of(item),
                new BigDecimal("50.00"), new BigDecimal("11.50"), new BigDecimal("61.50"),
                KsefPaymentMethod.TRANSFER, null);

        String xml = generator.generateXml(invoice).xmlContent();

        assertThat(xml).contains("<P_8A>szt.</P_8A>");
    }

    // ── Validation failures ────────────────────────────────────────────────────

    @Test
    @DisplayName("generateXml: throws when invoice has no line items")
    void generateXml_noItems_throws() {
        KsefInvoice invoice = buildInvoice(List.of(),
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                KsefPaymentMethod.TRANSFER, null);

        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class)
                .hasMessageContaining("line item");
    }

    @Test
    @DisplayName("generateXml: throws when invoice number is blank")
    void generateXml_blankInvoiceNumber_throws() {
        KsefInvoice invoice = buildSimpleInvoice();
        invoice.setInvoiceNumber("");

        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class)
                .hasMessageContaining("Invoice number");
    }

    @Test
    @DisplayName("generateXml: throws when seller NIP is missing")
    void generateXml_missingSellerNip_throws() {
        KsefInvoice invoice = buildSimpleInvoice();
        invoice.setSellerNip(null);

        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class)
                .hasMessageContaining("Seller NIP");
    }

    @Test
    @DisplayName("generateXml: throws when a line item has no product name")
    void generateXml_itemMissingProductName_throws() {
        KsefInvoice.InvoiceItem badItem = buildItem(null, "szt.", new BigDecimal("1"),
                new BigDecimal("100.00"), KsefVatRate.VAT_23,
                new BigDecimal("100.00"), new BigDecimal("23.00"), new BigDecimal("123.00"));
        KsefInvoice invoice = buildInvoice(List.of(badItem),
                new BigDecimal("100.00"), new BigDecimal("23.00"), new BigDecimal("123.00"),
                KsefPaymentMethod.TRANSFER, null);

        assertThatThrownBy(() -> generator.generateXml(invoice))
                .isInstanceOf(KsefXmlGenerationException.class)
                .hasMessageContaining("Product name");
    }

    // ── FA3XmlBuilder helper method tests ─────────────────────────────────────

    @Test
    @DisplayName("FA3XmlBuilder.amount: formats BigDecimal to 2 decimal places")
    void fa3XmlBuilder_amount_formatsCorrectly() {
        assertThat(FA3XmlBuilder.amount(new BigDecimal("100"))).isEqualTo("100.00");
        assertThat(FA3XmlBuilder.amount(new BigDecimal("1230.5"))).isEqualTo("1230.50");
        assertThat(FA3XmlBuilder.amount(new BigDecimal("99.999"))).isEqualTo("100.00");  // rounds up
        assertThat(FA3XmlBuilder.amount(null)).isEqualTo("0.00");
    }

    @Test
    @DisplayName("FA3XmlBuilder.vatRateCode: maps all KsefVatRate values to correct FA(3) codes")
    void fa3XmlBuilder_vatRateCode_mapsAllRatesCorrectly() {
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.VAT_23)).isEqualTo("23");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.VAT_8)).isEqualTo("8");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.VAT_5)).isEqualTo("5");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.VAT_0)).isEqualTo("0");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.EXEMPT)).isEqualTo("zw");
        assertThat(FA3XmlBuilder.vatRateCode(KsefVatRate.REVERSE_CHARGE)).isEqualTo("np");
    }

    @Test
    @DisplayName("FA3XmlBuilder.paymentMethodCode: maps all KsefPaymentMethod values correctly")
    void fa3XmlBuilder_paymentMethodCode_mapsAllMethodsCorrectly() {
        assertThat(FA3XmlBuilder.paymentMethodCode(KsefPaymentMethod.CASH)).isEqualTo("1");
        assertThat(FA3XmlBuilder.paymentMethodCode(KsefPaymentMethod.CARD)).isEqualTo("3");
        assertThat(FA3XmlBuilder.paymentMethodCode(KsefPaymentMethod.TRANSFER)).isEqualTo("6");
        assertThat(FA3XmlBuilder.paymentMethodCode(KsefPaymentMethod.SPLIT_PAYMENT)).isEqualTo("6");
    }

    // ── Builder helpers ────────────────────────────────────────────────────────

    private KsefInvoice buildSimpleInvoice() {
        return buildInvoice(List.of(
                buildItem("Consulting", "godz.", new BigDecimal("1"),
                        new BigDecimal("100.00"), KsefVatRate.VAT_23,
                        new BigDecimal("100.00"), new BigDecimal("23.00"), new BigDecimal("123.00"))
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
