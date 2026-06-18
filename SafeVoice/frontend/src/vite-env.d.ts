/// <reference types="vite/client" />

// Tells TypeScript about the SafeVoice environment variables Vite exposes on import.meta.env.
interface ImportMetaEnv {
  // Active jurisdiction (ISO 3166-1 alpha-2), e.g. "PL". See src/config/activeJurisdiction.ts.
  readonly VITE_SAFEVOICE_JURISDICTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
