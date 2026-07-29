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

// A brand-new tenant has no settings row yet, so the backend returns empty (null)
// string fields. Coerce them to '' so the Settings form's inputs stay controlled,
// and default the AI toggles — keeping the exact shape the page expects.
function normalize(s) {
  const c = s?.company ?? {};
  const d = s?.dpo ?? {};
  const ai = s?.ai ?? {};
  return {
    ...s,
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

// Send only the three editable groups (the backend owns id/tenant/timestamps).
function toRequest(patch) {
  return {
    company: patch.company,
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
