const mongoose = require('mongoose');
const { isValidBdoNumber } = require('../utils/bdoValidators');

// A Company is a single legal entity that must report packaging waste to BDO.
// One tenant (one RegulaOne customer) may own SEVERAL companies, so every
// company stores the tenantId it belongs to, and all data is scoped by it.
//
// The 9-digit BDO registration number is mandatory and is copied into every
// report this company generates.
const companySchema = new mongoose.Schema(
  {
    // The RegulaOne tenant that owns this company. Stored as a string because
    // that is exactly what the auth middleware resolves (req.tenantId).
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    // Company legal name.
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // BDO registration number — exactly 9 digits. This is the most important
    // field in the whole system: it identifies the company to the government
    // and must appear on every report.
    bdoRegistrationNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isValidBdoNumber,
        message: 'BDO registration number must be exactly 9 digits',
      },
    },

    // NIP — Polish tax identification number (10 digits). Optional but common.
    nip: {
      type: String,
      trim: true,
    },

    // REGON — Polish business statistics number. Optional.
    regon: {
      type: String,
      trim: true,
    },

    // Registered address. Kept inside the EEA per GDPR/RODO hosting rules.
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'Poland' },
    },

    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },

    contactPhone: {
      type: String,
      trim: true,
    },

    // Whether this company is currently active. We never hard-delete records
    // (10-year retention), so "removing" a company sets isActive=false and
    // stamps deletedAt instead.
    isActive: {
      type: Boolean,
      default: true,
    },

    // Soft-delete marker. A non-null value means the record is logically
    // deleted but kept for audit/retention.
    deletedAt: {
      type: Date,
      default: null,
    },

    // Who created / last changed the record (the user id from the session).
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    collection: 'wastesync_companies',
    timestamps: true,
  }
);

// A BDO number must be unique WITHIN a tenant. Two different customers could in
// theory hold the same number in our test data, but one customer must not have
// the same company twice. The partial filter ignores soft-deleted rows so a
// deleted company's number can be reused.
companySchema.index(
  { tenantId: 1, bdoRegistrationNumber: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

module.exports =
  mongoose.models.WasteSync_Company || mongoose.model('WasteSync_Company', companySchema);
