// Single source of truth for the packaging-waste categories WasteSync supports.
//
// Why this lives in one small file:
// BDO rules can change over time (new packaging categories may be added by the
// Polish government). Keeping the list here means a future change is a ONE-LINE
// edit — every model, validator, report, and the frontend all read from this
// same list, so they can never drift apart.
//
// Each category has:
//   - key:   the stable code we store in the database and the XML (never change it)
//   - labelPl: the Polish label shown to users / printed in reports
//   - labelEn: the English label (for non-Polish admins and logs)

const WASTE_CATEGORIES = [
  { key: 'PAPER', labelPl: 'Papier i tektura', labelEn: 'Paper and cardboard' },
  { key: 'PLASTIC', labelPl: 'Tworzywa sztuczne', labelEn: 'Plastic' },
  { key: 'GLASS', labelPl: 'Szkło', labelEn: 'Glass' },
  { key: 'METAL', labelPl: 'Metale', labelEn: 'Metal' },
  { key: 'MIXED', labelPl: 'Opakowania wielomateriałowe', labelEn: 'Mixed / multi-material packaging' },
];

// A plain list of just the keys — handy for Mongoose "enum" validation.
const WASTE_CATEGORY_KEYS = WASTE_CATEGORIES.map((c) => c.key);

// Quick lookup: key -> full category object (used when printing reports).
const WASTE_CATEGORY_MAP = WASTE_CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c;
  return acc;
}, {});

module.exports = {
  WASTE_CATEGORIES,
  WASTE_CATEGORY_KEYS,
  WASTE_CATEGORY_MAP,
};
