// Shared front-end constants. Keeping these in one file mirrors the backend's
// single-source-of-truth approach and keeps labels consistent across pages.

// The waste categories — MUST match the backend's utils/wasteCategories.js.
export const WASTE_CATEGORIES = [
  { key: "PAPER", label: "Paper & cardboard", labelPl: "Papier i tektura" },
  { key: "PLASTIC", label: "Plastic", labelPl: "Tworzywa sztuczne" },
  { key: "GLASS", label: "Glass", labelPl: "Szkło" },
  { key: "METAL", label: "Metal", labelPl: "Metale" },
  { key: "MIXED", label: "Mixed / multi-material", labelPl: "Wielomateriałowe" },
];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// A short list of recent years for the year picker (current year and the 4 before).
export const recentYears = () => {
  const now = new Date().getFullYear();
  return [now, now - 1, now - 2, now - 3, now - 4];
};

// Colours used by the charts so every chart looks consistent.
export const CATEGORY_COLORS = {
  PAPER: "#2563eb",
  PLASTIC: "#16a34a",
  GLASS: "#0891b2",
  METAL: "#9333ea",
  MIXED: "#d97706",
};
