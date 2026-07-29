// Resolve local services from the hostname used in the browser. Opening this
// app via localhost therefore calls localhost APIs; opening it via a LAN IP
// calls APIs on that same LAN IP. This preserves shared-cookie and CORS rules.

const protocol =
  typeof window !== "undefined" ? window.location.protocol : "http:";
const hostname =
  typeof window !== "undefined" ? window.location.hostname : "localhost";

const at = (port, path = "") => `${protocol}//${hostname}:${port}${path}`;
const followBrowserHost = import.meta.env.VITE_FOLLOW_BROWSER_HOST !== "false";

const isLocalNetworkHost = (host) =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "0.0.0.0" ||
  host === "::1" ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(host);

const resolveServiceUrl = (configuredUrl, port, defaultPath = "") => {
  if (!configuredUrl) return at(port, defaultPath);

  try {
    const parsed = new URL(configuredUrl);
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
    return configuredUrl.replace(/\/$/, "");
  }
};

export const REGULAONE_API_URL = resolveServiceUrl(
  import.meta.env.VITE_API_URL,
  8080
);
export const SAFEWORK_API_URL = resolveServiceUrl(
  import.meta.env.VITE_SAFEWORK_API_URL,
  8082
);
export const APP_URL = resolveServiceUrl(import.meta.env.VITE_APP_URL, 3002);
export const CENTRAL_LOGIN_URL = resolveServiceUrl(
  import.meta.env.VITE_CENTRAL_LOGIN_URL,
  3000,
  "/login"
);
