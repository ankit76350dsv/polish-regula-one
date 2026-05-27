package com.ksefflow.backend.services.fa3xmlutils;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefPaymentMethod;
import com.ksefflow.backend.models.utils.KsefVatRate;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

// Converts a KsefInvoice into a DOM Document conforming to the FA(3) schema.
//
// FA(3) is the official Polish e-invoice format mandated by the KSeF government system.
// Namespace: http://crd.gov.pl/wzor/2023/06/29/12648/
// Schema version: 1-0E
//
// Element naming follows the official Ministerstwo Finansów specification:
//   P_*  fields are numbered data fields per the schema (P_1 = issue date, P_7 = product name, etc.)
//   Named elements (Podmiot1, Fa, FaWiersz, Podsumowanie) match the XSD type names.
//
// VAT rate codes in FA(3):
//   "23", "8", "5", "0" → standard rates
//   "zw"                → zwolniony (VAT-exempt supply)
//   "np"                → nie podlega (outside VAT scope / reverse charge)
//
// Payment method codes (FormaPlatnosci):
//   "1" = gotówka (cash)
//   "3" = karta (card)
//   "6" = przelew (bank transfer / split payment)
//
// Podsumowanie VAT grouping (P_13_X net / P_14_X VAT):
//   _1 = 23%,  _2 = 8%,  _3 = 5%,  _4 = 0%,  _5 = zw,  _6 = np
public final class FA3XmlBuilder {

    public static final String FA3_NAMESPACE = "http://crd.gov.pl/wzor/2023/06/29/12648/";
    private static final String SCHEMA_CODE = "FA (3)";
    private static final String SCHEMA_VER = "1-0E";
    private static final String SYSTEM_INFO = "KSeFFlow v1.0 | RegulaOne";

    private static final DateTimeFormatter DT_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private FA3XmlBuilder() {
    }

    // ── Entry point ────────────────────────────────────────────────────────────

    public static Document build(KsefInvoice invoice) {
        validate(invoice);

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);

            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.newDocument();

            // Root FA(3) invoice element
            Element root = doc.createElementNS(FA3_NAMESPACE, "Faktura");
            doc.appendChild(root);

            // 1. Invoice header metadata
            // Contains schema version, invoice type,
            // issue date, currency, and system information.
            root.appendChild(buildNaglowek(doc, invoice));

            // 2. Seller information (Podmiot1)
            // Includes seller company details such as
            // NIP, name, and registered address.
            root.appendChild(buildPodmiot1(doc, invoice));

            // 3. Buyer information (Podmiot2)
            // Includes buyer/customer identification
            // and address information.
            root.appendChild(buildPodmiot2(doc, invoice));

            // 4. Main invoice section (Fa)
            // Contains invoice items, VAT details,
            // totals, payment data, and summary values.
            root.appendChild(buildFa(doc, invoice));

            return doc;

        } catch (KsefXmlGenerationException kxge) {
            throw kxge;

        } catch (Exception e) {
            throw new KsefXmlGenerationException("Failed to build FA(3) XML DOM for invoice [" + invoice.getInvoiceNumber() + "]: " + e.getMessage(), e);
        }
    }

    // ── Naglowek (HEADER METADATA) ──────────────────────────────────────────────────────

    private static Element buildNaglowek(Document doc, KsefInvoice invoice) {
        Element naglowek = el(doc, "Naglowek");

        Element kodFormularza = el(doc, "KodFormularza", "FA");
        kodFormularza.setAttribute("kodSystemowy", SCHEMA_CODE);
        kodFormularza.setAttribute("wersjaSchemy", SCHEMA_VER);
        naglowek.appendChild(kodFormularza);

        naglowek.appendChild(el(doc, "WariantFormularza", "3"));
        naglowek.appendChild(el(doc, "DataWytworzeniaFa",
                LocalDateTime.now().format(DT_FORMAT)));
        naglowek.appendChild(el(doc, "SystemInfo", SYSTEM_INFO));

        return naglowek;
    }

    // ── Podmiot1 (SELLER DATA) ──────────────────────────────────────────────────────

    private static Element buildPodmiot1(Document doc, KsefInvoice invoice) {
        Element podmiot1 = el(doc, "Podmiot1");
        podmiot1.appendChild(buildDaneIdentyfikacyjne(doc,
                invoice.getSellerNip(), invoice.getSellerName()));
        podmiot1.appendChild(buildAdres(doc,
                invoice.getSellerAddress(),
                invoice.getSellerPostalCode(), invoice.getSellerCity()));
        return podmiot1;
    }

    // ── Podmiot2 (BUYER DATA) ───────────────────────────────────────────────────────

    private static Element buildPodmiot2(Document doc, KsefInvoice invoice) {
        Element podmiot2 = el(doc, "Podmiot2");
        podmiot2.appendChild(buildDaneIdentyfikacyjne(doc,
                invoice.getBuyerNip(), invoice.getBuyerName()));
        podmiot2.appendChild(buildAdres(doc,
                invoice.getBuyerAddress(),
                invoice.getBuyerPostalCode(), invoice.getBuyerCity()));
        return podmiot2;
    }

    // ── Fa (INVOICE BODY (Items, Prices, Totals)) ───────────────────────────────────────────────────────

    private static Element buildFa(Document doc, KsefInvoice invoice) {
        Element fa = el(doc, "Fa");

        fa.appendChild(el(doc, "KodWaluty", invoice.getCurrency().name()));
        fa.appendChild(el(doc, "P_1", invoice.getIssueDate().toString()));
        fa.appendChild(el(doc, "P_2", invoice.getInvoiceNumber()));

        // P_6 = service/delivery date — use issue date when not separately tracked
        fa.appendChild(el(doc, "P_6", invoice.getIssueDate().toString()));

        // Total gross at Fa level (schema requires it here AND in Podsumowanie)
        fa.appendChild(el(doc, "P_15", amount(invoice.getTotalGross())));

        fa.appendChild(buildAdnotacje(doc, invoice));

        // Line items
        List<KsefInvoice.InvoiceItem> items = invoice.getItems();
        for (int i = 0; i < items.size(); i++) {
            fa.appendChild(buildFaWiersz(doc, items.get(i), i + 1));
        }

        fa.appendChild(buildPodsumowanie(doc, invoice));

        // Payment block (optional when dueDate is present)
        if (invoice.getDueDate() != null || invoice.getPaymentMethod() != null) {
            fa.appendChild(buildPlatnosc(doc, invoice));
        }

        return fa;
    }

    // ── Adnotacje (Annotations / flags) ───────────────────────────────────────

    private static Element buildAdnotacje(Document doc, KsefInvoice invoice) {
        Element ann = el(doc, "Adnotacje");

        // P_16: Mechanizm Podzielonej Płatności (MPP / split payment)
        // "1" = applies, "2" = does not apply
        boolean isMpp = invoice.getPaymentMethod() == KsefPaymentMethod.SPLIT_PAYMENT;
        ann.appendChild(el(doc, "P_16", isMpp ? "1" : "2"));

        // P_17: samofakturowanie (self-billing) — always "2" (no) here
        ann.appendChild(el(doc, "P_17", "2"));

        // P_18: odwrotne obciążenie (reverse charge) — "1" if any item uses
        // REVERSE_CHARGE
        boolean hasReverseCharge = invoice.getItems().stream()
                .anyMatch(i -> i.getVatRate() == KsefVatRate.REVERSE_CHARGE);
        ann.appendChild(el(doc, "P_18", hasReverseCharge ? "1" : "2"));

        // P_18A: VAT OSS — always "2" (no) — domestic invoices
        ann.appendChild(el(doc, "P_18A", "2"));

        // P_19: procedura marży (margin scheme) — always "2" (no)
        ann.appendChild(el(doc, "P_19", "2"));

        // P_22: wewnątrzwspólnotowe dostawy towarów (intra-EU goods) — always "2"
        ann.appendChild(el(doc, "P_22", "2"));

        // P_23: transakcje trójstronne (triangular transactions) — always "2"
        ann.appendChild(el(doc, "P_23", "2"));

        return ann;
    }

    // ── FaWiersz (Line item) ───────────────────────────────────────────────────

    private static Element buildFaWiersz(Document doc, KsefInvoice.InvoiceItem item, int lineNumber) {
        Element wiersz = el(doc, "FaWiersz");

        wiersz.appendChild(el(doc, "NrWierszaFa", String.valueOf(lineNumber)));
        wiersz.appendChild(el(doc, "P_7", item.getProductName()));
        wiersz.appendChild(el(doc, "P_8A", item.getUnit() != null ? item.getUnit() : "szt."));
        wiersz.appendChild(el(doc, "P_8B", qty(item.getQuantity())));
        wiersz.appendChild(el(doc, "P_9A", amount(item.getUnitPrice())));
        wiersz.appendChild(el(doc, "P_10", amount(item.getNetAmount())));
        wiersz.appendChild(el(doc, "P_11", vatRateCode(item.getVatRate())));
        wiersz.appendChild(el(doc, "P_12", amount(item.getVatAmount())));

        if (item.getPkwiuCode() != null && !item.getPkwiuCode().isBlank()) {
            wiersz.appendChild(el(doc, "GTU", item.getPkwiuCode()));
        }

        return wiersz;
    }

    // ── Podsumowanie (VAT summary) ─────────────────────────────────────────────

    private static Element buildPodsumowanie(Document doc, KsefInvoice invoice) {
        Element podsumowanie = el(doc, "Podsumowanie");

        // Group net and VAT amounts by rate for P_13_X / P_14_X fields
        Map<KsefVatRate, BigDecimal[]> grouped = groupByVatRate(invoice.getItems());

        Element podatekNalezny = el(doc, "PodatekNalezny");

        // Emit P_13_X (net) and P_14_X (VAT) only for rates that actually appear
        emitVatGroup(doc, podatekNalezny, grouped, KsefVatRate.VAT_23, "1");
        emitVatGroup(doc, podatekNalezny, grouped, KsefVatRate.VAT_8, "2");
        emitVatGroup(doc, podatekNalezny, grouped, KsefVatRate.VAT_5, "3");
        emitVatGroup(doc, podatekNalezny, grouped, KsefVatRate.VAT_0, "4");
        emitVatGroup(doc, podatekNalezny, grouped, KsefVatRate.EXEMPT, "5");
        emitVatGroup(doc, podatekNalezny, grouped, KsefVatRate.REVERSE_CHARGE, "6");

        podsumowanie.appendChild(podatekNalezny);
        podsumowanie.appendChild(el(doc, "P_15", amount(invoice.getTotalGross())));

        return podsumowanie;
    }

    private static void emitVatGroup(Document doc, Element parent,
            Map<KsefVatRate, BigDecimal[]> grouped,
            KsefVatRate rate, String suffix) {
        BigDecimal[] pair = grouped.get(rate);
        if (pair == null)
            return;
        parent.appendChild(el(doc, "P_13_" + suffix, amount(pair[0]))); // net
        parent.appendChild(el(doc, "P_14_" + suffix, amount(pair[1]))); // VAT
    }

    // Groups items by VAT rate → BigDecimal[]{totalNet, totalVat}
    private static Map<KsefVatRate, BigDecimal[]> groupByVatRate(List<KsefInvoice.InvoiceItem> items) {
        Map<KsefVatRate, BigDecimal[]> map = new EnumMap<>(KsefVatRate.class);
        for (KsefInvoice.InvoiceItem item : items) {
            KsefVatRate rate = item.getVatRate() != null ? item.getVatRate() : KsefVatRate.VAT_23;
            BigDecimal net = item.getNetAmount() != null ? item.getNetAmount() : BigDecimal.ZERO;
            BigDecimal vat = item.getVatAmount() != null ? item.getVatAmount() : BigDecimal.ZERO;
            map.merge(rate, new BigDecimal[] { net, vat },
                    (existing, incoming) -> new BigDecimal[] {
                            existing[0].add(incoming[0]),
                            existing[1].add(incoming[1])
                    });
        }
        return map;
    }

    // ── Platnosc (Payment) ─────────────────────────────────────────────────────

    private static Element buildPlatnosc(Document doc, KsefInvoice invoice) {
        Element platnosc = el(doc, "Platnosc");

        if (invoice.getDueDate() != null) {
            Element terminPlatnosci = el(doc, "TerminPlatnosci");
            terminPlatnosci.appendChild(el(doc, "Termin", invoice.getDueDate().toString()));
            platnosc.appendChild(terminPlatnosci);
        }

        if (invoice.getPaymentMethod() != null) {
            platnosc.appendChild(el(doc, "FormaPlatnosci",
                    paymentMethodCode(invoice.getPaymentMethod())));
        }

        // Bank account required for SPLIT_PAYMENT (MPP)
        if (invoice.getPaymentMethod() == KsefPaymentMethod.SPLIT_PAYMENT
                && invoice.getBankAccount() != null
                && !invoice.getBankAccount().isBlank()) {
            Element rachunek = el(doc, "RachunekBankowy");
            rachunek.appendChild(el(doc, "NrRB", invoice.getBankAccount()));
            platnosc.appendChild(rachunek);
        }

        return platnosc;
    }

    // ── Shared sub-elements ────────────────────────────────────────────────────

    private static Element buildDaneIdentyfikacyjne(Document doc, String nip, String nazwa) {
        Element dane = el(doc, "DaneIdentyfikacyjne");
        dane.appendChild(el(doc, "NIP", nip));
        dane.appendChild(el(doc, "Nazwa", nazwa));
        return dane;
    }

    private static Element buildAdres(Document doc,
            String adresL1, String postalCode, String city) {
        Element adres = el(doc, "Adres");
        adres.appendChild(el(doc, "KodKraju", "PL"));
        adres.appendChild(el(doc, "AdresL1", adresL1));
        adres.appendChild(el(doc, "AdresL2", postalCode + " " + city));
        return adres;
    }

    // ── Encoding helpers ───────────────────────────────────────────────────────

    // Formats monetary amounts: always 2 decimal places, period separator, no
    // grouping.
    // Polish accounting law requires exact 2-decimal precision for all VAT amounts.
    public static String amount(BigDecimal value) {
        if (value == null)
            return "0.00";
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    // Quantities: 2 decimal places (supports fractional units e.g. 1.50 hours)
    public static String qty(BigDecimal value) {
        if (value == null)
            return "1.00";
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    // Maps KsefVatRate enum → FA(3) XML rate code
    public static String vatRateCode(KsefVatRate rate) {
        if (rate == null)
            return "23";
        return switch (rate) {
            case VAT_23 -> "23";
            case VAT_8 -> "8";
            case VAT_5 -> "5";
            case VAT_0 -> "0";
            case EXEMPT -> "zw";
            case REVERSE_CHARGE -> "np";
        };
    }

    // Maps KsefPaymentMethod → FA(3) FormaPlatnosci code
    // 1 = gotówka (cash), 3 = karta (card), 6 = przelew (transfer/MPP)
    public static String paymentMethodCode(KsefPaymentMethod method) {
        if (method == null)
            return "6";
        return switch (method) {
            case CASH -> "1";
            case CARD -> "3";
            case TRANSFER,
                    SPLIT_PAYMENT ->
                "6";
        };
    }

    // ── DOM element factory ────────────────────────────────────────────────────

    private static Element el(Document doc, String name) {
        return doc.createElementNS(FA3_NAMESPACE, name);
    }

    private static Element el(Document doc, String name, String text) {
        Element e = doc.createElementNS(FA3_NAMESPACE, name);
        e.setTextContent(text);
        return e;
    }

    // ── Pre-build validation ───────────────────────────────────────────────────

    private static void validate(KsefInvoice invoice) {
        if (invoice.getInvoiceNumber() == null || invoice.getInvoiceNumber().isBlank()) {
            throw new KsefXmlGenerationException("Invoice number is required for FA(3) XML generation");
        }
        if (invoice.getIssueDate() == null) {
            throw new KsefXmlGenerationException(
                    "Issue date is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        if (invoice.getSellerNip() == null || invoice.getSellerNip().isBlank()) {
            throw new KsefXmlGenerationException(
                    "Seller NIP is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        if (invoice.getBuyerNip() == null || invoice.getBuyerNip().isBlank()) {
            throw new KsefXmlGenerationException(
                    "Buyer NIP is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        if (invoice.getItems() == null || invoice.getItems().isEmpty()) {
            throw new KsefXmlGenerationException(
                    "At least one line item is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        if (invoice.getTotalGross() == null) {
            throw new KsefXmlGenerationException(
                    "Total gross amount is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        for (int i = 0; i < invoice.getItems().size(); i++) {
            validateItem(invoice.getItems().get(i), i + 1, invoice.getInvoiceNumber());
        }
    }

    private static void validateItem(KsefInvoice.InvoiceItem item, int line, String invoiceNumber) {
        if (item.getProductName() == null || item.getProductName().isBlank()) {
            throw new KsefXmlGenerationException(
                    "Product name is required for line " + line + " of invoice [" + invoiceNumber + "]");
        }
        if (item.getNetAmount() == null) {
            throw new KsefXmlGenerationException(
                    "Net amount is required for line " + line + " of invoice [" + invoiceNumber + "]");
        }
        if (item.getVatAmount() == null) {
            throw new KsefXmlGenerationException(
                    "VAT amount is required for line " + line + " of invoice [" + invoiceNumber + "]");
        }
    }
}
