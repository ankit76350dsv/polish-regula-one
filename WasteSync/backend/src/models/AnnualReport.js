const mongoose = require('mongoose');

// An AnnualReport is the official yearly summary a company produces for BDO.
// It is built from the latest monthly WasteEntry rows for a given year, then
// saved together with the generated XML + PDF file locations in S3.
//
// Reports can be regenerated (e.g. after a correction), so we keep a version
// number and never delete old report documents — important for audits.
const annualReportSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WasteSync_Company',
      required: true,
      index: true,
    },

    // The reporting year this summary covers.
    year: { type: Number, required: true },

    // A snapshot of the company's BDO number AT THE TIME the report was made,
    // so the stored report stays correct even if the company record changes.
    bdoRegistrationNumber: { type: String, required: true },
    companyName: { type: String },

    // Total kilograms per category, e.g. { PAPER: 1200, PLASTIC: 300, ... }.
    categoryTotals: {
      type: Map,
      of: Number,
      default: {},
    },

    // Total kilograms across every category for the whole year.
    grandTotalKg: { type: Number, default: 0 },

    // 12 numbers (one per month) per category, so the PDF can show a breakdown.
    monthlyBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Months that had no data when the report was generated — surfaced so the
    // company knows the report may be incomplete.
    missingMonths: {
      type: [Number],
      default: [],
    },

    // The result of checking the totals against the configured legal thresholds.
    thresholdValidation: {
      // Was a real check performed at all? This is false when NO legal
      // thresholds were configured for the tenant/year, so the report can
      // honestly show "not evaluated" instead of a misleading green "passed".
      evaluated: { type: Boolean, default: false },
      // How many category limits the totals were compared against.
      thresholdsChecked: { type: Number, default: 0 },
      // Only meaningful when `evaluated` is true.
      passed: { type: Boolean, default: false },
      breaches: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },

    // Where the generated files live in S3 (private keys — never public URLs).
    xmlS3Key: { type: String },
    pdfS3Key: { type: String },

    // GENERATED  — files created and stored.
    // SUBMITTED  — the company has uploaded the XML to the BDO portal and marked
    //              the report as submitted here.
    status: {
      type: String,
      enum: ['GENERATED', 'SUBMITTED'],
      default: 'GENERATED',
    },

    // Increases each time the report is regenerated for the same year.
    version: { type: Number, default: 1 },

    generatedBy: { type: String },
  },
  {
    collection: 'wastesync_annual_reports',
    timestamps: true,
  }
);

// Quick lookup of all report versions for a company/year, newest first.
annualReportSchema.index({ tenantId: 1, companyId: 1, year: 1, version: -1 });

module.exports =
  mongoose.models.AnnualReport || mongoose.model('AnnualReport', annualReportSchema);
