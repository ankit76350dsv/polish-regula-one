// Which websites are allowed to call the SafeWork API from a browser.
//
// WHY THIS FILE EXISTS: the setting used to be a plain list, normally just
// "http://localhost:3002". A browser tells the API which site it is calling from (the
// "Origin"), and anything not on the list is refused. That meant a teammate who opened
// SafeWork at http://192.168.20.38:3002 was refused every request, because that address
// was not the same text as "localhost:3002" — even though it is the very same app on the
// very same machine.
//
// We cannot fix that by allowing everything: SafeWork sends the sign-in cookie with each
// request (credentials), and the browser rule is that a wildcard "*" is not allowed once
// cookies are involved. Allowing every site would also let any random page on the internet
// make calls as the signed-in user.
//
// So the rule is: the configured list is always honoured, and DURING DEVELOPMENT ONLY we
// also accept the same port on this computer or on a private office/home network. Nothing
// changes in production, where the list stays the only answer.
//
// Compliance note: this keeps browser access explicit and auditable (OWASP ASVS 14.5 /
// CLAUDE.md §6 "API security"), instead of reaching for a wildcard.

const config = require('./environment');

// Address ranges that mean "this computer" or "the local network we are all sitting on".
// The three IPv4 ranges are the private ones reserved by RFC 1918, which is what a home or
// office router hands out. A public internet address never matches.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

const isPrivateNetworkHost = (host) =>
  LOOPBACK_HOSTS.has(host) ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(host);

// The ports our own frontends run on, taken from the configured list so there is only ever
// one place to change them. "http://localhost:3002" therefore also permits
// "http://192.168.20.38:3002" while developing — same app, same port, different name.
const allowedFrontendPorts = new Set(
  config.cors.origins
    .map((origin) => {
      try {
        const { port, protocol } = new URL(origin);
        // A URL with no port means the protocol default (80 or 443).
        return port || (protocol === 'https:' ? '443' : '80');
      } catch {
        return null;
      }
    })
    .filter(Boolean)
);

// Remember which unknown callers we have already complained about, so a page that retries
// cannot flood the log. Bounded so it can never grow without limit.
const reportedOrigins = new Set();
const MAX_REPORTED_ORIGINS = 100;

const reportOnce = (origin) => {
  if (reportedOrigins.has(origin)) return;
  if (reportedOrigins.size >= MAX_REPORTED_ORIGINS) reportedOrigins.clear();
  reportedOrigins.add(origin);
  console.warn(
    `[CORS] Refused a browser request from ${origin}. ` +
      `Allowed: ${config.cors.origins.join(', ')}` +
      (config.cors.allowPrivateNetwork
        ? ` (plus this machine and private networks on port ${[...allowedFrontendPorts].join(', ')})`
        : '')
  );
};

/**
 * Decide whether one caller is allowed.
 *
 * @param {string|undefined} origin the browser's Origin header. Missing for a server-to-
 *        server call, a health check or curl — those are not browser requests, so the
 *        cross-site rules do not apply and we let them through.
 * @param {(err: Error|null, allow?: boolean) => void} callback
 */
const isAllowedOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);

  // 1. Explicitly configured — always allowed, in every environment.
  if (config.cors.origins.includes(origin)) return callback(null, true);

  // 2. Development convenience: the same app reached by another local name.
  if (config.cors.allowPrivateNetwork) {
    try {
      const { protocol, hostname, port } = new URL(origin);
      const effectivePort = port || (protocol === 'https:' ? '443' : '80');
      if (
        (protocol === 'http:' || protocol === 'https:') &&
        isPrivateNetworkHost(hostname) &&
        allowedFrontendPorts.has(effectivePort)
      ) {
        return callback(null, true);
      }
    } catch {
      // A malformed Origin is not something we try to interpret — it is refused below.
    }
  }

  // 3. Anything else is refused. We answer without the approval header rather than with an
  //    error, so the browser simply blocks the call and the log stays readable.
  reportOnce(origin);
  return callback(null, false);
};

module.exports = {
  origin: isAllowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Cache the browser's permission check for 10 minutes so it stops re-asking before every
  // single request.
  maxAge: 600,
  // Exposed for the startup banner and the tests.
  isAllowedOrigin,
  allowedFrontendPorts,
};
