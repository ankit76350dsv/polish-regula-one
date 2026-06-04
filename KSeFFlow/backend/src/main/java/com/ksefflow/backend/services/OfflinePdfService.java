package com.ksefflow.backend.services;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.ksefflow.backend.models.KsefInvoice;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.EnumMap;
import java.util.Map;

// @deprecated SUPERSEDED — the offline PDF is now generated CLIENT-SIDE from the invoice
// data + the two QR payloads (qrCodeOffline / qrCodeCertificate) produced by
// OfflineQrService. The legal record is the FA(3) XML in KSeF, not this PDF, so the
// server no longer renders or stores it. Kept for reference / potential server-side
// rendering needs, but it is no longer wired into the submission pipeline.
//
// Generates a legally-adequate offline PDF invoice with an embedded QR verification code.
//
// Used when the KSeF government API is unreachable (network timeout, maintenance).
// The PDF is sent to the buyer in offline mode; once KSeF comes back online the
// RetryQueueService submits the invoice XML and replaces this with a UPO-backed invoice.
//
// Legal note: in offline mode the invoice is NOT yet KSeF-registered. The Polish
// VAT Act (Dz.U. 2021 poz. 685) requires eventual submission — hence the retry queue.
// The QR code embeds the SHA-256 hash of the FA(3) XML so the buyer can verify
// authenticity before the KSeF ID is assigned.
@Service
@Slf4j
public class OfflinePdfService {

    private static final int QR_SIZE_PX = 150;
    private static final float MARGIN = 50f;
    private static final float LINE_HEIGHT = 16f;

    // Base URL used to construct the verification QR link.
    // Buyers can scan this to check the invoice status once it's registered with KSeF.
    @Value("${ksef.offline.verification-base-url:https://ksef.mf.gov.pl/offline/verify}")
    private String verificationBaseUrl;

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Generates an offline PDF invoice with embedded QR verification code.
     *
     * @param invoice     the invoice to render — must have fa3XmlHash set before calling
     * @return PDF bytes ready to send to the buyer or store in S3
     */
    public byte[] generateOfflinePdf(KsefInvoice invoice) {
        log.info("[GenerateOfflinePdf] Generating offline PDF for invoice [{}] tenant [{}]",
                invoice.getInvoiceNumber(), invoice.getTenantId());

        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float pageWidth  = page.getMediaBox().getWidth();
                float pageHeight = page.getMediaBox().getHeight();
                float y = pageHeight - MARGIN;

                PDType1Font bold    = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

                // ── Header ────────────────────────────────────────────────────
                y = writeLine(cs, bold, 16, MARGIN, y, "FAKTURA VAT (TRYB OFFLINE)");
                y = writeLine(cs, regular, 9, MARGIN, y - 4,
                        "Dokument wygenerowany w trybie offline — oczekuje na rejestrację w KSeF");
                y -= 8;

                // ── Invoice number + dates ─────────────────────────────────────
                y = writeLine(cs, bold, 11, MARGIN, y, "Nr faktury: " + invoice.getInvoiceNumber());
                y = writeLine(cs, regular, 10, MARGIN, y,
                        "Data wystawienia: " + invoice.getIssueDate());
                if (invoice.getDueDate() != null) {
                    y = writeLine(cs, regular, 10, MARGIN, y,
                            "Termin płatności: " + invoice.getDueDate());
                }
                y -= 10;

                // ── Seller ─────────────────────────────────────────────────────
                y = writeLine(cs, bold, 11, MARGIN, y, "SPRZEDAWCA");
                y = writeLine(cs, regular, 10, MARGIN, y, invoice.getSellerName());
                y = writeLine(cs, regular, 10, MARGIN, y, "NIP: " + invoice.getSellerNip());
                y = writeLine(cs, regular, 10, MARGIN, y,
                        invoice.getSellerAddress() + ", " +
                        invoice.getSellerPostalCode() + " " + invoice.getSellerCity());
                y -= 10;

                // ── Buyer ──────────────────────────────────────────────────────
                y = writeLine(cs, bold, 11, MARGIN, y, "NABYWCA");
                y = writeLine(cs, regular, 10, MARGIN, y, invoice.getBuyerName());
                y = writeLine(cs, regular, 10, MARGIN, y, "NIP: " + invoice.getBuyerNip());
                y = writeLine(cs, regular, 10, MARGIN, y,
                        invoice.getBuyerAddress() + ", " +
                        invoice.getBuyerPostalCode() + " " + invoice.getBuyerCity());
                y -= 12;

                // ── Line items header ──────────────────────────────────────────
                y = writeLine(cs, bold, 10, MARGIN, y, "POZYCJE FAKTURY");
                y -= 2;
                for (KsefInvoice.InvoiceItem item : invoice.getItems()) {
                    String line = String.format("  %s  |  %s %s  |  netto: %s PLN  |  VAT %s%%: %s PLN  |  brutto: %s PLN",
                            item.getProductName(),
                            item.getQuantity().toPlainString(),
                            item.getUnit() != null ? item.getUnit() : "szt.",
                            fmt(item.getNetAmount()),
                            item.getVatRate().name(),
                            fmt(item.getVatAmount()),
                            fmt(item.getGrossAmount()));
                    y = writeLine(cs, regular, 9, MARGIN, y, line);
                }
                y -= 10;

                // ── Totals ─────────────────────────────────────────────────────
                y = writeLine(cs, bold, 11, MARGIN, y,
                        "RAZEM NETTO: " + fmt(invoice.getTotalNet()) + " PLN");
                y = writeLine(cs, regular, 11, MARGIN, y,
                        "VAT: " + fmt(invoice.getTotalVat()) + " PLN");
                y = writeLine(cs, bold, 12, MARGIN, y,
                        "RAZEM BRUTTO: " + fmt(invoice.getTotalGross()) + " " +
                        (invoice.getCurrency() != null ? invoice.getCurrency().name() : "PLN"));
                y -= 10;

                // ── Payment info ───────────────────────────────────────────────
                if (invoice.getPaymentMethod() != null) {
                    y = writeLine(cs, regular, 10, MARGIN, y,
                            "Forma płatności: " + invoice.getPaymentMethod().name());
                }
                if (invoice.getBankAccount() != null) {
                    y = writeLine(cs, regular, 10, MARGIN, y,
                            "Nr rachunku: " + invoice.getBankAccount());
                }
                y -= 14;

                // ── Offline notice ─────────────────────────────────────────────
                y = writeLine(cs, bold, 9, MARGIN, y,
                        "UWAGA: Faktura oczekuje na nadanie numeru KSeF. " +
                        "Status weryfikacji: " + verificationUrl(invoice));

                // ── QR code (bottom-right corner) ──────────────────────────────
                String qrContent = verificationUrl(invoice);
                byte[] qrPng = generateQrPng(qrContent);
                PDImageXObject qrImage = PDImageXObject.createFromByteArray(doc, qrPng, "qr");

                float qrX = pageWidth - MARGIN - QR_SIZE_PX;
                float qrY = MARGIN;
                cs.drawImage(qrImage, qrX, qrY, QR_SIZE_PX, QR_SIZE_PX);

                // QR label
                cs.beginText();
                cs.setFont(regular, 7);
                cs.newLineAtOffset(qrX, qrY - 10);
                cs.showText("Zeskanuj aby sprawdzić status KSeF");
                cs.endText();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            log.debug("[GenerateOfflinePdf] Offline PDF generated ({} bytes) for invoice [{}]",
                    out.size(), invoice.getInvoiceNumber());
            return out.toByteArray();

        } catch (IOException e) {
            log.error("[GenerateOfflinePdf] Failed to generate offline PDF for invoice [{}]: {}",
                    invoice.getInvoiceNumber(), e.getMessage(), e);
            throw new RuntimeException("Offline PDF generation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Returns the QR verification URL embedded in the offline PDF.
     * Format: {verificationBaseUrl}?hash={fa3XmlHash}
     * Once the invoice is registered with KSeF, this URL can show the KSeF ID.
     */
    public String verificationUrl(KsefInvoice invoice) {
        String hash = invoice.getFa3XmlHash() != null ? invoice.getFa3XmlHash() : "pending";
        return verificationBaseUrl + "?inv=" + invoice.getInvoiceNumber() + "&hash=" + hash;
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private static float writeLine(PDPageContentStream cs, PDType1Font font,
                                   float size, float x, float y, String text) throws IOException {
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(text != null ? text : "");
        cs.endText();
        return y - LINE_HEIGHT;
    }

    private static byte[] generateQrPng(String content) {
        try {
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.MARGIN, 1);

            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE,
                    QR_SIZE_PX, QR_SIZE_PX, hints);

            BufferedImage image = MatrixToImageWriter.toBufferedImage(matrix);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "PNG", out);
            return out.toByteArray();

        } catch (WriterException | IOException e) {
            throw new RuntimeException("QR code generation failed: " + e.getMessage(), e);
        }
    }

    private static String fmt(java.math.BigDecimal value) {
        return value != null ? value.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString() : "0.00";
    }
}
