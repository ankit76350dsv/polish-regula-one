// Where the other RegulaOne services live, as seen from THIS browser.
//
// THE PROBLEM THIS SOLVES: the addresses used to be written down as
// "http://localhost:8082" — in five different files. "localhost" means "the computer I am
// running on", so when a teammate opened SafeWork at http://192.168.x.y:3002 their
// browser tried to reach a SafeWork backend on THEIR OWN laptop. There was none, so every
// screen failed to load.
//
// So we do not write the host down at all. We take whichever host the person typed in the
// address bar and reuse it for every service, changing only the port number:
//
//   opened as http://localhost:3002        → API at http://localhost:8082
//   opened as http://192.168.x.y:3002    → API at http://192.168.x.y:8082
//
// The login cookie follows the same rule (a cookie belongs to a host, and ports do not
// matter to it), so signing in works the same way on both addresses.
//
// This host-following only happens between LOCAL addresses. A real staging or production
// URL set in VITE_* is always used exactly as written — see resolveServiceUrl below.
// WasteSync and WorkPulse use this same file, so every module behaves the same way.

const protocol =
  typeof window !== "undefined" ? window.location.protocol : "http:";
const hostname =
  typeof window !== "undefined" ? window.location.hostname : "localhost";

// Build an address on the current host with a given port, e.g. at(8082) →
// "http://192.168.x.y:8082".
const at = (port, path = "") => `${protocol}//${hostname}:${port}${path}`;

// An escape hatch: set VITE_FOLLOW_BROWSER_HOST=false to switch the behaviour off and use
// the configured URLs exactly as written.
const followBrowserHost = import.meta.env.VITE_FOLLOW_BROWSER_HOST !== "false";

// Is this host on this machine or on the office/home network? These are the only hosts we
// are willing to rewrite, so a production URL can never be redirected somewhere else.
// Covers loopback plus the three private IPv4 ranges reserved by RFC 1918.
const isLocalNetworkHost = (host) =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "0.0.0.0" ||
  host === "::1" ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(host);

/**
 * Work out the address of one service.
 *
 * @param {string|undefined} configuredUrl the VITE_* value, if someone set one
 * @param {number} port the port this service uses on a developer machine
 * @param {string} [defaultPath] a path to append (the login page needs "/login")
 */
const resolveServiceUrl = (configuredUrl, port, defaultPath = "") => {
  if (!configuredUrl) {
    // Nothing configured. On a developer machine, use this browser's host with the service's
    // port — that is the whole point of this file.
    if (isLocalNetworkHost(hostname)) return at(port, defaultPath);

    // But on a REAL address (a staging or production domain) a developer port is certainly
    // wrong: "https://safework.regulaone.eu:8082" is a broken guess that looks plausible and
    // fails at runtime. A deployed site sits behind a proxy that routes by path, so we stay
    // on the current address and add no port at all. Setting the VITE_* variables is still
    // the correct thing to do for a deployment; this is only a safer fallback.
    return `${protocol}//${hostname}${defaultPath}`;
  }

  try {
    const parsed = new URL(configuredUrl);
    // Only swap the host when BOTH the browser and the configured URL are local. That is
    // the "same laptop, reached by a different name" case. A real remote URL is untouched.
    if (
      followBrowserHost &&
      isLocalNetworkHost(hostname) &&
      isLocalNetworkHost(parsed.hostname)
    ) {
      parsed.protocol = protocol;
      parsed.hostname = hostname;
      parsed.port = String(port);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    // Not a valid URL — hand it back untouched rather than guessing.
    return configuredUrl.replace(/\/$/, "");
  }
};

// RegulaOne backend — owns sign-in, sign-out and "who am I". Port 8080.
export const REGULAONE_API_URL = resolveServiceUrl(
  import.meta.env.VITE_API_URL,
  8080
);

// The SafeWork backend — employee compliance profiles, documents, dashboard. Port 8082.
export const SAFEWORK_API_URL = resolveServiceUrl(
  import.meta.env.VITE_SAFEWORK_API_URL,
  8082
);

// The SafeWork API with its "/api" prefix — what nearly every caller actually wants.
// Exported so the base address is written down ONCE instead of in five files.
export const SAFEWORK_API_BASE = `${SAFEWORK_API_URL}/api`;

// This app's own address, used to build the page RegulaOne returns to after sign-in.
export const APP_URL = resolveServiceUrl(import.meta.env.VITE_APP_URL, 3002);

// The central RegulaOne sign-in page. Port 3000.
export const CENTRAL_LOGIN_URL = resolveServiceUrl(
  import.meta.env.VITE_CENTRAL_LOGIN_URL,
  3000,
  "/login"
);
