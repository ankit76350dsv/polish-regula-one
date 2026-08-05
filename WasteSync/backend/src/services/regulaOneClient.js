const config = require('../config/environment');

// ── One place for every call WasteSync makes to the central RegulaOne backend ──
//
// RegulaOne is the "head office" of the platform. It owns two things WasteSync
// must never invent for itself:
//
//   1. WHO the caller is        -> GET /api/auth/me     (user + tenantId + permissions)
//   2. WHAT the company IS      -> GET /api/tenant/info (legal name, NIP, REGON, address)
//
// A company is created ONCE, in RegulaOne, when the customer signs up. WasteSync
// only reads it. That is why there is no "create company" screen here any more:
// two copies of the same legal entity could drift apart, and a report filed with
// a stale company name or NIP is a filing error in front of a government
// register.
//
// Every call forwards the SAME credentials the browser sent us — the shared
// login cookie, and/or the Bearer token for non-browser clients. We never send a
// tenant id: RegulaOne works it out from the token itself, so one customer can
// never ask for another customer's details.

// Shared low-level fetch. Returns the unwrapped `data` object, or null when the
// call fails for ANY reason (network down, 401, bad JSON). Returning null rather
// than throwing lets each caller decide how serious the failure is.
const callRegulaOne = async (path, req, token) => {
  const headers = {};

  // Forward the browser's cookies untouched — this is how the shared SSO session
  // travels between the RegulaOne login and each module's backend.
  if (req?.headers?.cookie) headers.cookie = req.headers.cookie;

  // Backup path for Postman / mobile, which send a Bearer token instead.
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${config.regulaOne.baseUrl}${path}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) return null;

    const json = await response.json();
    // RegulaOne wraps every answer as { success, message, data }.
    return json?.data ?? null;
  } catch (error) {
    // Network error / RegulaOne down. We deliberately do NOT log the error body:
    // it can contain the forwarded token or personal data.
    return null;
  }
};

/**
 * Asks RegulaOne "who is this logged-in user?".
 * Returns the UserResponse ({ tenantId, permissions, ... }) or null on failure.
 */
const fetchCurrentUser = async (req, token) => {
  const data = await callRegulaOne('/api/auth/me', req, token);
  // Some deployments nest the user one level deeper; accept both shapes.
  return data?.user ?? data ?? null;
};

/**
 * Asks RegulaOne "what is this user's company?".
 *
 * Calls GET /api/tenant/info, which derives the tenant from the token. The answer
 * looks like:
 *   { id, name, nip, regon, email, phone, address, city, postalCode, status,
 *     createdAt, updatedAt }
 *
 * Returns that object, or null when RegulaOne cannot be reached.
 */
const fetchTenantProfile = async (req, token) =>
  callRegulaOne('/api/tenant/info', req, token);

module.exports = {
  fetchCurrentUser,
  fetchTenantProfile,
};
