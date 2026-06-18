// SafeVoice jurisdiction configuration.
//
// This file holds the country-specific rules that change between EU member states.
// The whole point is simple: to launch SafeVoice in a new EU country, you add ONE
// object here instead of editing screens. Everything legal that varies by country
// (who the external authority is, how long data is kept, what language to show first)
// lives in one place so the rest of the app can stay generic.
//
// Every legal number below is taken from an official source, written next to it so a
// future developer can re-check it. See SafeVoice/docs/compliance/ for the full notes.

import { ReportCategory } from "../types";

// One external authority a reporter can go to outside the company.
export interface ExternalAuthority {
  // Short label shown to the user, e.g. "Commissioner for Human Rights (RPO)".
  name: string;
  // Official website so the reporter can reach the authority directly.
  url: string;
}

// All the rules that change from one EU country to another.
export interface Jurisdiction {
  // ISO 3166-1 alpha-2 country code, e.g. "PL".
  code: string;
  // Human-readable country name in English (used for admin tooling).
  countryName: string;
  // The organisation that decides why and how report data is processed (GDPR controller).
  controllerName: string;
  // The internal team/processor that handles the reports day to day.
  processorName: string;
  // Where a reporter can report OUTSIDE the company (national authority).
  externalAuthority: ExternalAuthority;
  // How many days the company has to confirm it received the report.
  acknowledgementDays: number;
  // How many months the company has to give feedback on what it did.
  feedbackMonths: number;
  // Extra months allowed for feedback in justified, complex cases (0 if not allowed).
  feedbackExtensionMonths: number;
  // How many years the report register is kept after the case year ends.
  retentionYears: number;
  // How many days to delete personal data that turns out to be irrelevant.
  irrelevantDataDeletionDays: number;
  // The language the portal shows first in this country.
  defaultLocale: string;
  // All languages this country deployment offers.
  supportedLocales: string[];
  // Short note naming the law(s) this deployment follows (shown in the footer/notices).
  legalBasisLabel: string;
}

// ---------------------------------------------------------------------------
// EU-wide baseline.
//
// These values come straight from Directive (EU) 2019/1937 and apply in every EU
// country unless a national law is stricter. We use this as the fallback so a new
// country still behaves legally even before someone fills in its national details.
// Source: Directive (EU) 2019/1937 Art. 9(1)(b) (7 days) and Art. 9(1)(f) (3 months).
// https://eur-lex.europa.eu/eli/dir/2019/1937/oj/eng
// ---------------------------------------------------------------------------
export const EU_DEFAULT: Jurisdiction = {
  code: "EU",
  countryName: "European Union (baseline)",
  controllerName: "RegulaOne (tenant controller)",
  processorName: "SafeVoice EU hosting processor",
  externalAuthority: {
    // Each country must point this at its own competent authority before launch.
    name: "National competent authority",
    url: "https://commission.europa.eu/about-european-commission/contact_en"
  },
  acknowledgementDays: 7, // Directive Art. 9(1)(b)
  feedbackMonths: 3, // Directive Art. 9(1)(f)
  feedbackExtensionMonths: 0, // Directive sets no general extension; national law may add one.
  retentionYears: 3, // Common transposition default; confirm per country.
  irrelevantDataDeletionDays: 14, // Conservative default; confirm per country.
  defaultLocale: "en",
  supportedLocales: ["en"],
  legalBasisLabel: "Directive (EU) 2019/1937 and GDPR"
};

// ---------------------------------------------------------------------------
// Poland — fully verified against the official text published by the Polish
// Commissioner for Human Rights (BRPO) and EUR-Lex.
// Act of 14 June 2024 on the Protection of Whistleblowers (Ustawa o ochronie sygnalistów),
// Journal of Laws (Dz.U.) 2024 item 928.
//   - Art. 37: acknowledge within 7 days.
//   - Art. 41(1): feedback within 3 months; Art. 41(2): up to 6 months in justified cases.
//   - Art. 8(8): retain register 3 years after the calendar year follow-up ended.
//   - Art. 8(4): delete irrelevant personal data within 14 days of finding it irrelevant.
//   - Art. 31: external reports go to the Commissioner for Human Rights (RPO) / public authorities.
//   - Art. 7(1): anonymous reports may be accepted.
// https://bip.brpo.gov.pl/en/content/act-protection-whistleblowers
// ---------------------------------------------------------------------------
export const POLAND: Jurisdiction = {
  code: "PL",
  countryName: "Poland",
  controllerName: "RegulaOne Poland S.A.",
  processorName: "SafeVoice EU hosting processor",
  externalAuthority: {
    name: "Commissioner for Human Rights (Rzecznik Praw Obywatelskich)",
    url: "https://bip.brpo.gov.pl/en"
  },
  acknowledgementDays: 7, // Polish Act Art. 37
  feedbackMonths: 3, // Polish Act Art. 41(1)
  feedbackExtensionMonths: 6, // Polish Act Art. 41(2): extendable to 6 months in justified cases
  retentionYears: 3, // Polish Act Art. 8(8)
  irrelevantDataDeletionDays: 14, // Polish Act Art. 8(4)
  defaultLocale: "pl",
  supportedLocales: ["pl", "en"],
  legalBasisLabel:
    "Directive (EU) 2019/1937 and the Polish Act of 14 June 2024 on the Protection of Whistleblowers"
};

// ---------------------------------------------------------------------------
// Example template countries.
//
// These are NOT legally verified yet. They show how to add a new EU state: copy one,
// fill in the national authority and any numbers the national law changes, then have
// counsel confirm them before going live. Until verified they fall back to EU baseline
// values, which are safe defaults.
// ---------------------------------------------------------------------------
export const GERMANY: Jurisdiction = {
  ...EU_DEFAULT,
  code: "DE",
  countryName: "Germany",
  controllerName: "RegulaOne Deutschland GmbH",
  externalAuthority: {
    // Hinweisgeberschutzgesetz (HinSchG) — confirm before production.
    name: "Federal Office of Justice external reporting office (Bundesamt für Justiz)",
    url: "https://www.bundesjustizamt.de"
  },
  defaultLocale: "de",
  supportedLocales: ["de", "en"],
  legalBasisLabel: "Directive (EU) 2019/1937 and the German Hinweisgeberschutzgesetz (HinSchG)"
};

export const FRANCE: Jurisdiction = {
  ...EU_DEFAULT,
  code: "FR",
  countryName: "France",
  controllerName: "RegulaOne France SAS",
  externalAuthority: {
    // Loi Sapin II / Défenseur des droits — confirm before production.
    name: "Défenseur des droits",
    url: "https://www.defenseurdesdroits.fr"
  },
  defaultLocale: "fr",
  supportedLocales: ["fr", "en"],
  legalBasisLabel: "Directive (EU) 2019/1937 and the French Loi Sapin II"
};

// Lookup table of every jurisdiction we ship, keyed by country code.
export const JURISDICTIONS: Record<string, Jurisdiction> = {
  EU: EU_DEFAULT,
  PL: POLAND,
  DE: GERMANY,
  FR: FRANCE
};

// The set of report categories follows the material scope of Directive (EU) 2019/1937
// (Art. 2) and is the same across EU countries, so it is defined once here.
export const REPORT_CATEGORIES: ReportCategory[] = Object.values(ReportCategory);
