const PDFDocument = require('pdfkit');
const { WASTE_CATEGORY_MAP } = require('../utils/wasteCategories');

// Month names for the breakdown table. Index 0 is unused so month 1 = January.
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Builds a professionally formatted PDF of the annual report and returns it as
// a Buffer (so the caller can upload it straight to S3).
//
// pdfkit writes to a stream, so we collect all the chunks and resolve a single
// Buffer once the document is finished.
const generateAnnualReportPdf = ({
  company,
  year,
  categoryTotals,
  grandTotalKg,
  monthlyBreakdown,
  thresholdValidation,
  missingMonths,
  generatedAt,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Title ────────────────────────────────────────────────────────────
      doc.fontSize(20).font('Helvetica-Bold').text('BDO Annual Packaging Waste Report', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).font('Helvetica').fillColor('#555')
        .text(`Reporting year: ${year}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);

      // ── Company details ──────────────────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Company');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Name: ${company.name || '-'}`);
      doc.text(`BDO Registration Number: ${company.bdoRegistrationNumber}`);
      if (company.nip) doc.text(`NIP: ${company.nip}`);
      if (company.regon) doc.text(`REGON: ${company.regon}`);
      const addr = company.address || {};
      const addressLine = [addr.street, addr.postalCode, addr.city, addr.country]
        .filter(Boolean)
        .join(', ');
      if (addressLine) doc.text(`Address: ${addressLine}`);
      doc.moveDown(1);

      // ── Yearly totals per category ───────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Yearly totals by category (kg)');
      doc.moveDown(0.5);

      const startX = doc.x;
      let y = doc.y;
      const col2 = startX + 320;

      // Header row.
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Category', startX, y);
      doc.text('Total (kg)', col2, y);
      y += 18;
      doc.moveTo(startX, y).lineTo(545, y).stroke('#cccccc');
      y += 6;

      // Data rows.
      doc.font('Helvetica');
      for (const [category, total] of Object.entries(categoryTotals)) {
        const meta = WASTE_CATEGORY_MAP[category];
        const label = meta ? `${meta.labelEn} (${meta.labelPl})` : category;
        doc.text(label, startX, y, { width: 300 });
        doc.text(String(total), col2, y);
        y += 18;
      }

      // Grand total row.
      y += 4;
      doc.moveTo(startX, y).lineTo(545, y).stroke('#cccccc');
      y += 6;
      doc.font('Helvetica-Bold');
      doc.text('GRAND TOTAL', startX, y);
      doc.text(String(grandTotalKg), col2, y);
      doc.font('Helvetica');
      doc.moveDown(2);

      // ── Threshold validation result ──────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Legal threshold check');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      if (!thresholdValidation?.evaluated) {
        // No legal limits were configured, so nothing could be checked. Say so
        // plainly instead of printing a green "PASSED" that was never earned.
        doc.fillColor('#9a6700').text(
          'NOT EVALUATED — no legal thresholds are configured for this year, so the totals could not be checked against any limit.'
        );
      } else if (thresholdValidation.passed) {
        doc.fillColor('#1a7f37').text(
          `PASSED — checked against ${thresholdValidation.thresholdsChecked} configured limit(s); no legal maximum was exceeded.`
        );
        // Reporting-threshold crossings are informational, not failures — list them.
        for (const breach of thresholdValidation.breaches || []) {
          doc.fillColor('#9a6700').text(`  • ${breach.message}`);
        }
      } else {
        doc.fillColor('#b00020').text('ATTENTION — one or more legal maximums were exceeded:');
        for (const breach of thresholdValidation.breaches || []) {
          doc.text(`  • ${breach.message}`);
        }
      }
      doc.fillColor('#000');

      // ── Missing months notice ────────────────────────────────────────────
      if (missingMonths && missingMonths.length > 0) {
        doc.moveDown(0.5);
        doc.fillColor('#9a6700').text(
          `Note: no data was recorded for: ${missingMonths.map((m) => MONTH_NAMES[m]).join(', ')}.`
        );
        doc.fillColor('#000');
      }
      doc.moveDown(1.5);

      // ── Monthly breakdown table ──────────────────────────────────────────
      if (monthlyBreakdown) {
        doc.fontSize(14).font('Helvetica-Bold').text('Monthly breakdown (kg)');
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica');
        for (let month = 1; month <= 12; month += 1) {
          const data = monthlyBreakdown[month];
          const parts = data
            ? Object.entries(data).map(([cat, val]) => `${cat}: ${val}`)
            : ['no data'];
          doc.text(`${MONTH_NAMES[month]}: ${parts.join(', ')}`);
        }
      }

      // ── Footer ───────────────────────────────────────────────────────────
      doc.moveDown(2);
      doc.fontSize(8).fillColor('#888').text(
        `Generated by WasteSync (RegulaOne) on ${generatedAt}. This document is for company records and audit purposes.`,
        { align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateAnnualReportPdf };
