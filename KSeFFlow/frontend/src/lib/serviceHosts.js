// LAN-friendly host resolution for KSeFFlow.
//
// When no explicit VITE_* URL is set, each service URL is derived from the host
// the page was opened on. This lets the SAME running dev server work on
// http://localhost AND http://<machine-ip> at the same time (localhost →
// localhost backends, IP → IP backends) with no rebuild and no cookie/CORS
// mismatch. An explicit VITE_* env var still wins when provided (staging/prod).
//
// Port map: RegulaOne backend :8080 · KSeFFlow backend :8081 · this app :3001 ·
// RegulaOne central login :3000.

const proto = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const host  = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const at = (port) => `${proto}//${host}:${port}`;

export const REGULA_ONE_API_URL = import.meta.env.VITE_REGULA_ONE_API_URL || import.meta.env.VITE_API_URL || at(8080);
export const KSEF_API_URL       = import.meta.env.VITE_KSEF_API_URL       || at(8081);
export const APP_URL            = import.meta.env.VITE_APP_URL            || at(3001);
export const CENTRAL_LOGIN      = import.meta.env.VITE_CENTRAL_LOGIN_URL  || `${at(3000)}/login`;
export const CENTRAL_SIGNUP     = import.meta.env.VITE_CENTRAL_SIGNUP_URL || new URL('/auth/signup', CENTRAL_LOGIN).toString();
