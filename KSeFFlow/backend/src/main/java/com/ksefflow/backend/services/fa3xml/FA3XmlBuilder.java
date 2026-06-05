package com.ksefflow.backend.services.fa3xml;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefPaymentMethod;
import com.ksefflow.backend.models.utils.KsefVatRate;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilderFactory;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

// SIMPLE EXPLANATION:
// This class turns one invoice (from our database) into the official FA(3) XML that KSeF wants.
//
// FA(3) is the NEW Polish e-invoice shape, required from 1 February 2026.
// Official schema (we ship it locally): resources/xsd/fa3/schemat.xsd
// Official namespace (the "address" of the schema): http://crd.gov.pl/wzor/2025/06/25/13775/
//
// The shape below was copied from the OFFICIAL example invoice that already passes the
// FA(3) check (ksef-client-java sample), so we are not guessing the structure.
//
// The big parts of the invoice, in order:
//   Naglowek   = the header (form code, version, made-on date)
//   Podmiot1   = the seller
//   Podmiot2   = the buyer
//   Fa         = the body (money totals, notes, and the lines)
public final class FA3XmlBuilder {

    // FA(3) namespace and form info (from the official schema + example).
    public static final String FA3_NAMESPACE = "http://crd.gov.pl/wzor/2025/06/25/13775/";
    private static final String SCHEMA_CODE = "FA (3)";
    private static final String SCHEMA_VER = "1-0E";
    private static final String SYSTEM_INFO = "RegulaOne KSeFFlow";

    private FA3XmlBuilder() {
    }

    //! ── Entry point ────────────────────────────────────────────────────────────

    public static Document build(KsefInvoice invoice) {
        // First make sure the invoice has the must-have fields.
        validate(invoice);

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            Document doc = factory.newDocumentBuilder().newDocument();

            // The top tag <Faktura> with the FA(3) namespace.
            Element root = doc.createElementNS(FA3_NAMESPACE, "Faktura");
            doc.appendChild(root);

            // The 4 big parts, in the exact order the schema wants.
            root.appendChild(buildNaglowek(doc));        // header
            root.appendChild(buildPodmiot1(doc, invoice)); // seller
            root.appendChild(buildPodmiot2(doc, invoice)); // buyer
            root.appendChild(buildFa(doc, invoice));       // invoice body

            return doc;
        } catch (KsefXmlGenerationException kxge) {
            throw kxge;
        } catch (Exception e) {
            throw new KsefXmlGenerationException("Failed to build FA(3) XML for invoice ["
                    + invoice.getInvoiceNumber() + "]: " + e.getMessage(), e);
        }
    }

    //! ── Naglowek (HEADER) ───────────────────────────────────────────────────────

    // Build the invoice header: which form, which version, and when it was made.
    private static Element buildNaglowek(Document doc) {
        Element naglowek = element(doc, "Naglowek");

        // The form code tag carries two attributes that name the schema.
        Element kodFormularza = element(doc, "KodFormularza", "FA");
        kodFormularza.setAttribute("kodSystemowy", SCHEMA_CODE); // "FA (3)"
        kodFormularza.setAttribute("wersjaSchemy", SCHEMA_VER);   // "1-0E"
        naglowek.appendChild(kodFormularza);

        // The form variant for FA(3) is always 3.
        naglowek.appendChild(element(doc, "WariantFormularza", "3"));

        // The exact moment we made this XML, in world time (UTC, ends with "Z").
        naglowek.appendChild(element(doc, "DataWytworzeniaFa",
                Instant.now().truncatedTo(ChronoUnit.SECONDS).toString()));

        // The name of the system that made it (just info).
        naglowek.appendChild(element(doc, "SystemInfo", SYSTEM_INFO));
        return naglowek;
    }

    //! ── Podmiot1 (SELLER) ───────────────────────────────────────────────────────

    private static Element buildPodmiot1(Document doc, KsefInvoice invoice) {
        Element podmiot1 = element(doc, "Podmiot1");
        // Who the seller is: tax number + name.
        podmiot1.appendChild(buildDaneIdentyfikacyjne(doc, invoice.getSellerNip(), invoice.getSellerName()));
        // Where the seller is.
        podmiot1.appendChild(buildAdres(doc, invoice.getSellerAddress(),
                invoice.getSellerPostalCode(), invoice.getSellerCity()));
        return podmiot1;
    }

    //! ── Podmiot2 (BUYER) ────────────────────────────────────────────────────────

    private static Element buildPodmiot2(Document doc, KsefInvoice invoice) {
        Element podmiot2 = element(doc, "Podmiot2");
        // Who the buyer is: tax number + name.
        podmiot2.appendChild(buildDaneIdentyfikacyjne(doc, invoice.getBuyerNip(), invoice.getBuyerName()));
        // Where the buyer is.
        podmiot2.appendChild(buildAdres(doc, invoice.getBuyerAddress(),
                invoice.getBuyerPostalCode(), invoice.getBuyerCity()));
        // The schema MUST have these two yes/no flags for the buyer:
        //   JST = is the buyer a local-government unit?  GV = is the buyer a VAT group?
        // For a normal company buyer both are "2" (no), as in the official example.
        podmiot2.appendChild(element(doc, "JST", "2"));
        podmiot2.appendChild(element(doc, "GV", "2"));
        return podmiot2;
    }

    //! ── Fa (INVOICE BODY) ───────────────────────────────────────────────────────

    private static Element buildFa(Document doc, KsefInvoice invoice) {
        Element fa = element(doc, "Fa");

        // Money currency, issue date, and invoice number.
        fa.appendChild(element(doc, "KodWaluty", invoice.getCurrency().name()));
        fa.appendChild(element(doc, "P_1", invoice.getIssueDate().toString())); // issue date (a day)
        fa.appendChild(element(doc, "P_2", invoice.getInvoiceNumber()));        // invoice number

        // Money totals, grouped by VAT rate (must be in this exact number order).
        Map<KsefVatRate, BigDecimal[]> byRate = groupByVatRate(invoice.getItems());
        appendVatTotals(doc, fa, byRate);

        // Total amount to pay (gross). Always present.
        fa.appendChild(element(doc, "P_15", amount(invoice.getTotalGross())));

        // The required note flags (split payment, etc.).
        fa.appendChild(buildAdnotacje(doc, invoice));

        // The kind of invoice. A normal one is "VAT".
        fa.appendChild(element(doc, "RodzajFaktury", "VAT"));

        // The invoice lines (one per product/service).
        List<KsefInvoice.InvoiceItem> items = invoice.getItems();
        for (int i = 0; i < items.size(); i++) {
            fa.appendChild(buildFaWiersz(doc, items.get(i), i + 1));
        }
        return fa;
    }

    // Put the net and tax totals into the right P_13_x / P_14_x tags, in number order.
    // Official meaning (from the schema notes):
    //   P_13_1/P_14_1 = 23% (or 22%)   P_13_2/P_14_2 = 8% (or 7%)   P_13_3/P_14_3 = 5%
    //   P_13_6_1 = 0%        P_13_7 = exempt (zwolnione)        P_13_10 = reverse charge
    private static void appendVatTotals(Document doc, Element fa, Map<KsefVatRate, BigDecimal[]> byRate) {
        // 23% — the schema/example always shows this pair, even when it is 0.00.
        BigDecimal[] r23 = byRate.getOrDefault(KsefVatRate.VAT_23, zeroPair());
        fa.appendChild(element(doc, "P_13_1", amount(r23[0])));
        fa.appendChild(element(doc, "P_14_1", amount(r23[1])));

        // 8% — only if the invoice has 8% lines.
        if (byRate.containsKey(KsefVatRate.VAT_8)) {
            fa.appendChild(element(doc, "P_13_2", amount(byRate.get(KsefVatRate.VAT_8)[0])));
            fa.appendChild(element(doc, "P_14_2", amount(byRate.get(KsefVatRate.VAT_8)[1])));
        }
        // 5% — only if present.
        if (byRate.containsKey(KsefVatRate.VAT_5)) {
            fa.appendChild(element(doc, "P_13_3", amount(byRate.get(KsefVatRate.VAT_5)[0])));
            fa.appendChild(element(doc, "P_14_3", amount(byRate.get(KsefVatRate.VAT_5)[1])));
        }
        // 0% — only the net sum (there is no tax). Field P_13_6_1.
        if (byRate.containsKey(KsefVatRate.VAT_0)) {
            fa.appendChild(element(doc, "P_13_6_1", amount(byRate.get(KsefVatRate.VAT_0)[0])));
        }
        // Exempt (zwolnione) — only the net sum. Field P_13_7.
        if (byRate.containsKey(KsefVatRate.EXEMPT)) {
            fa.appendChild(element(doc, "P_13_7", amount(byRate.get(KsefVatRate.EXEMPT)[0])));
        }
        // Reverse charge — only the net sum. Field P_13_10.
        if (byRate.containsKey(KsefVatRate.REVERSE_CHARGE)) {
            fa.appendChild(element(doc, "P_13_10", amount(byRate.get(KsefVatRate.REVERSE_CHARGE)[0])));
        }
    }

    // ── Adnotacje (NOTE FLAGS) ──────────────────────────────────────────────────
    // These yes/no flags are required. "2" = no / not applicable. The nested boxes
    // (Zwolnienie, NoweSrodkiTransportu, PMarzy) use a "...N" tag = "does not apply".
    // Values copied from the official example invoice.
    private static Element buildAdnotacje(Document doc, KsefInvoice invoice) {
        Element ann = element(doc, "Adnotacje");

        // P_16 = split payment used?  "1" yes, "2" no.
        boolean splitPayment = invoice.getPaymentMethod() == KsefPaymentMethod.SPLIT_PAYMENT;
        ann.appendChild(element(doc, "P_16", splitPayment ? "1" : "2"));
        ann.appendChild(element(doc, "P_17", "2")); // self-billing? no
        ann.appendChild(element(doc, "P_18", "2")); // foreign-currency note? no
        ann.appendChild(element(doc, "P_18A", "2")); // cash method note? no

        // Tax exemption box — "does not apply".
        Element zwolnienie = element(doc, "Zwolnienie");
        zwolnienie.appendChild(element(doc, "P_19N", "1"));
        ann.appendChild(zwolnienie);

        // New means of transport box — "does not apply".
        Element nowe = element(doc, "NoweSrodkiTransportu");
        nowe.appendChild(element(doc, "P_22N", "1"));
        ann.appendChild(nowe);

        ann.appendChild(element(doc, "P_23", "2")); // simplified procedure? no

        // Margin scheme box — "does not apply".
        Element marza = element(doc, "PMarzy");
        marza.appendChild(element(doc, "P_PMarzyN", "1"));
        ann.appendChild(marza);

        return ann;
    }

    // ── FaWiersz (ONE INVOICE LINE) ─────────────────────────────────────────────
    // Official meaning: P_7 = name, P_8A = unit, P_8B = how many, P_9A = price for one,
    //                   P_11 = net value of the line, P_12 = tax rate.
    private static Element buildFaWiersz(Document doc, KsefInvoice.InvoiceItem item, int lineNumber) {
        Element wiersz = element(doc, "FaWiersz");
        wiersz.appendChild(element(doc, "NrWierszaFa", String.valueOf(lineNumber))); // line number
        wiersz.appendChild(element(doc, "P_7", item.getProductName()));               // name
        wiersz.appendChild(element(doc, "P_8A", item.getUnit() != null ? item.getUnit() : "szt.")); // unit
        wiersz.appendChild(element(doc, "P_8B", qty(item.getQuantity())));            // quantity
        wiersz.appendChild(element(doc, "P_9A", amount(item.getUnitPrice())));        // price for one (net)
        wiersz.appendChild(element(doc, "P_11", amount(item.getNetAmount())));        // line net value
        wiersz.appendChild(element(doc, "P_12", vatRateCode(item.getVatRate())));     // tax rate
        return wiersz;
    }

    // ── Shared small parts ──────────────────────────────────────────────────────

    private static Element buildDaneIdentyfikacyjne(Document doc, String nip, String nazwa) {
        Element dane = element(doc, "DaneIdentyfikacyjne");
        dane.appendChild(element(doc, "NIP", nip));
        dane.appendChild(element(doc, "Nazwa", nazwa));
        return dane;
    }

    // Address: country, street line, and postcode + city on the second line.
    private static Element buildAdres(Document doc, String adresL1, String postalCode, String city) {
        Element adres = element(doc, "Adres");
        adres.appendChild(element(doc, "KodKraju", "PL"));
        adres.appendChild(element(doc, "AdresL1", adresL1));
        adres.appendChild(element(doc, "AdresL2", (safe(postalCode) + " " + safe(city)).trim()));
        return adres;
    }

    // ── Value helpers ───────────────────────────────────────────────────────────

    // Money: always 2 numbers after the dot, e.g. 123.45.
    public static String amount(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    // Quantity: also 2 numbers after the dot.
    public static String qty(BigDecimal value) {
        return (value == null ? BigDecimal.ONE : value).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    // Turn our rate name into the rate text the schema wants.
    public static String vatRateCode(KsefVatRate rate) {
        if (rate == null) return "23";
        return switch (rate) {
            case VAT_23 -> "23";
            case VAT_8 -> "8";
            case VAT_5 -> "5";
            case VAT_0 -> "0";
            case EXEMPT -> "zw";          // zwolnione
            case REVERSE_CHARGE -> "oo";  // odwrotne obciążenie
        };
    }

    // Add up net and tax for each rate. Returns rate -> [net, tax].
    private static Map<KsefVatRate, BigDecimal[]> groupByVatRate(List<KsefInvoice.InvoiceItem> items) {
        Map<KsefVatRate, BigDecimal[]> map = new EnumMap<>(KsefVatRate.class);
        for (KsefInvoice.InvoiceItem item : items) {
            KsefVatRate rate = item.getVatRate() != null ? item.getVatRate() : KsefVatRate.VAT_23;
            BigDecimal net = item.getNetAmount() != null ? item.getNetAmount() : BigDecimal.ZERO;
            BigDecimal vat = item.getVatAmount() != null ? item.getVatAmount() : BigDecimal.ZERO;
            map.merge(rate, new BigDecimal[] { net, vat },
                    (a, b) -> new BigDecimal[] { a[0].add(b[0]), a[1].add(b[1]) });
        }
        return map;
    }

    private static BigDecimal[] zeroPair() {
        return new BigDecimal[] { BigDecimal.ZERO, BigDecimal.ZERO };
    }

    private static String safe(String s) {
        return s != null ? s : "";
    }

    // ── DOM tag makers ──────────────────────────────────────────────────────────

    private static Element element(Document doc, String name) {
        return doc.createElementNS(FA3_NAMESPACE, name);
    }

    private static Element element(Document doc, String name, String text) {
        Element e = doc.createElementNS(FA3_NAMESPACE, name);
        e.setTextContent(text);
        return e;
    }

    //! ── Pre-build checks (must-have fields) ─────────────────────────────────────

    private static void validate(KsefInvoice invoice) {
        if (invoice.getInvoiceNumber() == null || invoice.getInvoiceNumber().isBlank()) {
            throw new KsefXmlGenerationException("Invoice number is required for FA(3) XML");
        }
        if (invoice.getIssueDate() == null) {
            throw new KsefXmlGenerationException("Issue date is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        if (invoice.getCurrency() == null) {
            throw new KsefXmlGenerationException("Currency is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        if (invoice.getSellerNip() == null || invoice.getSellerNip().isBlank()) {
            throw new KsefXmlGenerationException("Seller NIP is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        if (invoice.getBuyerNip() == null || invoice.getBuyerNip().isBlank()) {
            throw new KsefXmlGenerationException("Buyer NIP is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        if (invoice.getItems() == null || invoice.getItems().isEmpty()) {
            throw new KsefXmlGenerationException("At least one line item is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        if (invoice.getTotalGross() == null) {
            throw new KsefXmlGenerationException("Total gross is required for invoice [" + invoice.getInvoiceNumber() + "]");
        }
        for (int i = 0; i < invoice.getItems().size(); i++) {
            KsefInvoice.InvoiceItem item = invoice.getItems().get(i);
            if (item.getProductName() == null || item.getProductName().isBlank()) {
                throw new KsefXmlGenerationException("Product name is required for line " + (i + 1)
                        + " of invoice [" + invoice.getInvoiceNumber() + "]");
            }
            if (item.getNetAmount() == null) {
                throw new KsefXmlGenerationException("Net amount is required for line " + (i + 1)
                        + " of invoice [" + invoice.getInvoiceNumber() + "]");
            }
        }
    }
}
