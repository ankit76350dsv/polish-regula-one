const mongoose = require('mongoose');
const { WASTE_CATEGORY_KEYS } = require('../utils/wasteCategories');

// A WasteThreshold stores a configurable legal limit for one waste category in
// one year. Keeping thresholds in the database (instead of hard-coding them)
// means an administrator can update the limits when BDO rules change, without
// any code change — this is exactly what the "configurable legal thresholds"
// requirement asks for.
//
// tenantId can be null, which means "platform default" — used when a tenant has
// not set its own value for that category/year.
const wasteThresholdSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: null,
      index: true,
    },

    category: {
      type: String,
      enum: WASTE_CATEGORY_KEYS,
      required: true,
    },

    year: { type: Number, required: true },

    // The weight (kg) above which the category must be reported / flagged.
    reportingThresholdKg: { type: Number, default: null },

    // The legal maximum (kg). Going over this is treated as a hard breach.
    maxWeightKg: { type: Number, default: null },

    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    collection: 'wastesync_thresholds',
    timestamps: true,
  }
);

// One threshold row per tenant + category + year.
wasteThresholdSchema.index(
  { tenantId: 1, category: 1, year: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.WasteThreshold || mongoose.model('WasteThreshold', wasteThresholdSchema);
