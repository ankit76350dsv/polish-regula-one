const mongoose = require('mongoose');
const { isValidBdoNumber } = require('../utils/bdoValidators');

// ── The only company data WasteSync stores ───────────────────────────────────
//
// WHY THIS REPLACED THE OLD Company MODEL
// WasteSync used to keep a whole Company document: name, NIP, REGON, address,
// contact details. That was a second copy of something the central RegulaOne
// platform already owns. One customer = one company, and RegulaOne registers it
// at sign-up, so the copy did nothing but risk disagreeing with the legal record
// — and those details are printed on reports filed with a government register.
//
// Everything about the company is now read live from RegulaOne's
// GET /api/tenant/info. The ONE thing RegulaOne does not hold is the 9-digit BDO
// registration number, because it only matters for environmental reporting. That
// number is what this tiny document stores.
//
// There is exactly ONE row per tenant, keyed by tenantId — which is also how
// every waste entry and report is now scoped. No companyId anywhere.
//
// Note on soft delete: the platform rule is that business records are never hard
// deleted. This is a settings row, not a business record — it is created once and
// updated in place, and every change is written to the immutable audit log, so
// the full history is recoverable there. There is therefore no deletedAt column.
const companySettingsSchema = new mongoose.Schema(
  {
    // The RegulaOne tenant these settings belong to. This is the ONLY key — one
    // tenant has one company, so the tenant id IS the company id.
    tenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // BDO registration number — exactly 9 digits. This is the most important
    // value in the whole module: it identifies the company to the Polish BDO
    // register and must appear on every report.
    bdoRegistrationNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isValidBdoNumber,
        message: 'BDO registration number must be exactly 9 digits',
      },
    },

    // Who first set the number, and who last changed it (user ids from session).
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    collection: 'wastesync_company_settings',
    timestamps: true,
  }
);

module.exports =
  mongoose.models.WasteSync_CompanySettings ||
  mongoose.model('WasteSync_CompanySettings', companySettingsSchema);
