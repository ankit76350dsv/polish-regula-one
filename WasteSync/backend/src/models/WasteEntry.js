const mongoose = require('mongoose');
const { WASTE_CATEGORY_KEYS } = require('../utils/wasteCategories');

// One line of waste data inside a monthly entry: a category and its weight.
const wasteItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: WASTE_CATEGORY_KEYS,
      required: true,
    },
    // Weight in kilograms. Negative weights are impossible, so we block them.
    weightKg: {
      type: Number,
      required: true,
      min: [0, 'Weight cannot be negative'],
    },
  },
  { _id: false }
);

// A WasteEntry is the packaging-waste figures a company recorded for ONE month.
//
// Append-only design (this is the heart of the "never overwrite" rule):
//   - We never edit an existing entry. When a company corrects a month, we save
//     a BRAND NEW document with version + 1 and flip the old one's isLatest to
//     false. The old figures stay in the database forever.
//   - Reads use { isLatest: true } to get the current value, but the full
//     history is always available for a government audit.
const wasteEntrySchema = new mongoose.Schema(
  {
    // Tenant + company this entry belongs to (tenant isolation).
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

    // The reporting period.
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },

    // The per-category weights for this month.
    items: {
      type: [wasteItemSchema],
      default: [],
    },

    // Sum of all item weights — computed automatically on save so reports and
    // dashboards never have to recalculate it.
    totalWeightKg: {
      type: Number,
      default: 0,
    },

    // Free-text note (e.g. "corrected after invoice review").
    notes: { type: String, trim: true },

    // ── Versioning fields ──────────────────────────────────────────────────
    // version starts at 1 and increases by 1 each correction.
    version: { type: Number, default: 1 },
    // Only the newest version of a month has isLatest = true.
    isLatest: { type: Boolean, default: true, index: true },
    // Points back to the document this one replaced (null for the first one).
    supersedesEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WasteEntry',
      default: null,
    },

    // Who recorded this version.
    createdBy: { type: String },
  },
  {
    collection: 'wastesync_waste_entries',
    timestamps: true,
  }
);

// Before saving, add up the item weights into totalWeightKg. Doing this in one
// place means the total can never disagree with the line items.
wasteEntrySchema.pre('validate', function (next) {
  this.totalWeightKg = (this.items || []).reduce(
    (sum, item) => sum + (Number(item.weightKg) || 0),
    0
  );
  next();
});

// Block direct updates. Corrections must go through the service, which creates
// a new version — this keeps the historical record truthful.
wasteEntrySchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function () {
  throw new Error(
    'Waste entries are append-only. Create a new version instead of updating.'
  );
});

// Fast lookups for the most common queries:
//   - the current value of every month in a year for a company
wasteEntrySchema.index({ tenantId: 1, companyId: 1, year: 1, month: 1, isLatest: 1 });
//   - the full version history of one specific month
wasteEntrySchema.index({ companyId: 1, year: 1, month: 1, version: -1 });

module.exports =
  mongoose.models.WasteEntry || mongoose.model('WasteEntry', wasteEntrySchema);
