// Picks which country's rules SafeVoice runs with right now.
//
// A deployment sets VITE_SAFEVOICE_JURISDICTION (for example "PL" for Poland) at build
// time. If it is missing or unknown, we fall back to Poland, because that is the primary
// market for this platform. The rest of the app asks this module "what are the rules?"
// instead of hardcoding Polish values everywhere.

import { JURISDICTIONS, POLAND, type Jurisdiction } from "./jurisdictions";

// Read the chosen country code from the environment. Vite exposes variables that start
// with VITE_ on import.meta.env. We default to "PL" when nothing is set.
const configuredCode = (import.meta.env.VITE_SAFEVOICE_JURISDICTION as string | undefined)?.toUpperCase();

// The active jurisdiction object the whole app shares. If the configured code is not one
// we know about, we use Poland so the app still has safe, verified legal values.
export const activeJurisdiction: Jurisdiction =
  (configuredCode && JURISDICTIONS[configuredCode]) || POLAND;

// Small hook-style helper so components can read the rules with a familiar name.
// The config does not change while the app is running, so this just returns the object.
export const useJurisdiction = (): Jurisdiction => activeJurisdiction;
