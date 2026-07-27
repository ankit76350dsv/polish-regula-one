const { create } = require('xmlbuilder2');
const { WASTE_CATEGORY_MAP } = require('../utils/wasteCategories');

// Builds the BDO annual report as an XML string.
//
// The XML follows the official BDO reporting structure: it carries the BDO
// registration number, the reporting year, the company identity, and the waste
// totals per category. The file is designed to be uploaded MANUALLY to the
// official Polish BDO portal, so we keep the structure clean and predictable.
//
// NOTE on compliance: the exact element names/namespace of the government
// schema must be confirmed against the current official BDO specification
// before production use. The structure here is organised so that adapting to a
// new schema version is a localised change in this one file (supporting the
// "future regulation changes without major refactor" requirement).
const generateAnnualReportXml = ({
  company,
  year,
  categoryTotals,
  grandTotalKg,
  monthlyBreakdown,
}) => {
  // Start the document with a UTF-8 header (Polish characters need UTF-8).
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('BDOReport', {
    type: 'ANNUAL_PACKAGING_WASTE',
    year: String(year),
  });

  // ── Company identity block ────────────────────────────────────────────────
  const companyEle = root.ele('Company');
  companyEle.ele('BDORegistrationNumber').txt(company.bdoRegistrationNumber).up();
  companyEle.ele('Name').txt(company.name || '').up();
  if (company.nip) companyEle.ele('NIP').txt(company.nip).up();
  if (company.regon) companyEle.ele('REGON').txt(company.regon).up();
  const addr = company.address || {};
  companyEle
    .ele('Address')
    .ele('Street').txt(addr.street || '').up()
    .ele('City').txt(addr.city || '').up()
    .ele('PostalCode').txt(addr.postalCode || '').up()
    .ele('Country').txt(addr.country || 'Poland').up()
    .up();
  companyEle.up();

  // ── Reporting period ──────────────────────────────────────────────────────
  root.ele('ReportingPeriod').ele('Year').txt(String(year)).up().up();

  // ── Per-category yearly totals ──────────────────────────────────────────────
  const wasteEle = root.ele('PackagingWaste', { unit: 'kg' });
  for (const [category, total] of Object.entries(categoryTotals)) {
    const meta = WASTE_CATEGORY_MAP[category];
    wasteEle
      .ele('WasteCategory', { code: category })
      .ele('NamePl').txt(meta ? meta.labelPl : category).up()
      .ele('TotalWeightKg').txt(String(total)).up()
      .up();
  }
  wasteEle.up();

  // ── Optional month-by-month breakdown (helps audits) ───────────────────────
  if (monthlyBreakdown) {
    const breakdownEle = root.ele('MonthlyBreakdown');
    for (let month = 1; month <= 12; month += 1) {
      const monthData = monthlyBreakdown[month];
      if (!monthData) continue;
      const monthEle = breakdownEle.ele('Month', { number: String(month) });
      for (const [category, total] of Object.entries(monthData)) {
        monthEle.ele('Category', { code: category }).txt(String(total)).up();
      }
      monthEle.up();
    }
    breakdownEle.up();
  }

  // ── Grand total ─────────────────────────────────────────────────────────────
  root.ele('GrandTotalWeightKg').txt(String(grandTotalKg)).up();

  // Pretty-print so the file is human-readable as well as machine-readable.
  return root.end({ prettyPrint: true });
};

module.exports = { generateAnnualReportXml };
