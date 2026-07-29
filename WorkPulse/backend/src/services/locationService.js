// ─────────────────────────────────────────────────────────────────────────────
// Location service — GPS checks for mobile clock-in/clock-out.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS:
//   When people clock in from a phone, the company may want to confirm they are
//   actually at the work site (a "geofence"), and to spot fake GPS ("spoofing").
//
// IMPORTANT PRIVACY RULE (Art. 22² Kodeks pracy + GDPR/RODO):
//   Tracking where an employee is counts as employee monitoring. It is only
//   allowed when the company has turned it on for a real reason AND told the
//   employee first. So location is ONLY ever looked at when the tenant policy
//   has `locationTrackingEnabled = true`. When it is off, we ignore location
//   completely — we do not even store it.
//
// This file only does the MATH and the CHECKS. Turning tracking on/off and
// storing the employee's "I was told" acknowledgement live elsewhere.

const EARTH_RADIUS_METERS = 6371000;

// Distance in metres between two lat/lng points (the haversine formula).
// Used to check how far a punch was from an allowed work site.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// Are these coordinates real numbers inside the valid lat/lng range?
function looksLikeValidCoords(loc) {
  return (
    loc &&
    typeof loc.latitude === 'number' &&
    typeof loc.longitude === 'number' &&
    loc.latitude >= -90 &&
    loc.latitude <= 90 &&
    loc.longitude >= -180 &&
    loc.longitude <= 180
  );
}

// Find the nearest allowed work site (geofence) and whether the punch is inside
// its radius. Returns { withinGeofence, matchedSite, distanceMeters } or null if
// the tenant has not set up any geofences (then we cannot check location).
function checkGeofence(policy, loc) {
  const fences = Array.isArray(policy.geofences) ? policy.geofences : [];
  if (fences.length === 0) return null;

  let best = null;
  for (const f of fences) {
    if (typeof f.latitude !== 'number' || typeof f.longitude !== 'number') continue;
    const distance = haversineMeters(loc.latitude, loc.longitude, f.latitude, f.longitude);
    if (!best || distance < best.distanceMeters) {
      best = {
        matchedSite: f.site || 'site',
        distanceMeters: Math.round(distance),
        radiusMeters: f.radiusMeters || 200,
      };
    }
  }
  if (!best) return null;
  return { ...best, withinGeofence: best.distanceMeters <= best.radiusMeters };
}

// Look at one punch and decide what to record and what to warn about.
//
//   policy    — the tenant working-time policy (has the geofences + limits).
//   location  — { latitude, longitude, accuracy, mocked } sent by the app.
//   device    — { platform, deviceId, mocked } sent by the app (optional).
//   prevPunch — the previous stored punch location + time (for speed check).
//   now       — the time of this punch.
//
// Returns a clean object to store on the time entry, including a list of
// human-readable warning flags. It NEVER throws — the caller decides whether a
// flag should block the punch or just be recorded.
function evaluatePunch({ policy, location, device = {}, prevPunch = null, now = new Date() }) {
  const flags = [];

  // No coordinates at all from a mobile punch is itself worth noting.
  if (!looksLikeValidCoords(location)) {
    flags.push('NO_LOCATION');
    return {
      captured: false,
      valid: false,
      flags,
    };
  }

  const accuracy = typeof location.accuracy === 'number' ? location.accuracy : null;
  const maxAccuracy = policy.maxAccuracyMeters || 100;

  // Poor GPS accuracy means we cannot trust the position for geofencing.
  if (accuracy !== null && accuracy > maxAccuracy) {
    flags.push('LOW_ACCURACY');
  }

  // The app told us the location was faked (Android exposes a "mock location"
  // flag). This is the clearest spoofing signal we can get.
  const mocked = Boolean(location.mocked || device.mocked);
  if (mocked) flags.push('MOCK_LOCATION');

  // Geofence: was the punch near an allowed work site?
  const geo = checkGeofence(policy, location);
  if (geo && !geo.withinGeofence) flags.push('OUTSIDE_GEOFENCE');

  // "Teleport" check: if the person appears to have moved impossibly fast since
  // their last punch, the GPS is probably fake. We use 900 km/h (faster than a
  // car or train) as an obviously-impossible speed.
  let speedKmh = null;
  if (prevPunch && looksLikeValidCoords(prevPunch) && prevPunch.at) {
    const meters = haversineMeters(
      prevPunch.latitude,
      prevPunch.longitude,
      location.latitude,
      location.longitude
    );
    const hours = Math.abs(new Date(now).getTime() - new Date(prevPunch.at).getTime()) / 3600000;
    if (hours > 0) {
      speedKmh = Math.round(meters / 1000 / hours);
      if (speedKmh > 900) flags.push('IMPOSSIBLE_TRAVEL');
    }
  }

  return {
    captured: true,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy,
    mocked,
    platform: device.platform,
    deviceId: device.deviceId,
    withinGeofence: geo ? geo.withinGeofence : undefined,
    matchedSite: geo ? geo.matchedSite : undefined,
    distanceMeters: geo ? geo.distanceMeters : undefined,
    speedKmh,
    // The punch is "valid" when nothing serious was flagged.
    valid: flags.length === 0,
    flags,
    at: now,
  };
}

module.exports = {
  haversineMeters,
  looksLikeValidCoords,
  checkGeofence,
  evaluatePunch,
};
