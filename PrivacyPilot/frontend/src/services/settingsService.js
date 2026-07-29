// Company + DPO + AI settings (one record per tenant), including the Polish DPO/UODO
// notification tracker (Art. 10–11, Act of 10 May 2018: 14 days, electronic only).
//
// This now talks to the REAL PrivacyPilot backend (SettingsController):
// GET/PUT on /api/privacypilot/settings. It replaced the in-browser mock.
import { get, put } from './client';

const BASE = '/api/privacypilot/settings';

/** Days remaining in the 14-day UODO notification window; null when not applicable. */
export function uodoWindow(dpo) {
  if (!dpo?.appointedAt || dpo.uodoNotifiedAt) return null;
  const deadline = new Date(dpo.appointedAt).getTime() + 14 * 24 * 60 * 60 * 1000;
  return Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000));
}

// The company block is READ-ONLY here — it comes from RegulaOne (the shared tenant),
// which is the single source of truth for the company legal identity. It is edited on
// RegulaOne's company profile page, never here. A brand-new tenant has no PrivacyPilot
// settings row yet, so the backend returns empty (null) DPO/AI fields — coerce them to
// '' so the form inputs stay controlled, and default the AI toggles.
function normalize(s) {
  const c = s?.company ?? {};
  const d = s?.dpo ?? {};
  const ai = s?.ai ?? {};
  return {
    ...s,
    // Read-only, sourced from RegulaOne. NIP/REGON/address come from the tenant; KRS and
    // website are not tracked in RegulaOne yet, so they stay blank.
    company: {
      name: c.name ?? '', nip: c.nip ?? '', regon: c.regon ?? '',
      krs: c.krs ?? '', address: c.address ?? '', website: c.website ?? '',
    },
    dpo: {
      name: d.name ?? '', email: d.email ?? '', phone: d.phone ?? '',
      appointedAt: d.appointedAt ?? null,
      uodoNotifiedAt: d.uodoNotifiedAt ?? null,
      publishedOnWebsite: Boolean(d.publishedOnWebsite),
    },
    ai: {
      enabled: ai.enabled ?? true,
      excludeSpecialCategories: ai.excludeSpecialCategories ?? true,
    },
  };
}

// Send ONLY the two editable groups. The company is intentionally omitted — the backend
// rejects any attempt to change it here (RegulaOne owns it).
function toRequest(patch) {
  return {
    dpo: patch.dpo,
    ai: patch.ai,
  };
}

export const settingsService = {
  /** The caller's company settings (blank object if none saved yet). */
  get: () => get(BASE).then(normalize),

  /** Save the settings (server upserts). Admin-only server-side. */
  update: (patch) => put(BASE, toRequest(patch)).then(normalize),
};
