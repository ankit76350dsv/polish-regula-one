// Tenant-scoped URL helpers.
//
// Every in-app page lives under /company/{tenantId}/… so the URL always shows
// which organisation you are working in (same shape as KSeFFlow). These helpers
// build those paths from the signed-in user's tenant, so no page has to hardcode
// the "/company/{id}" prefix.
import { useSelector } from 'react-redux';

// Build a tenant-scoped path, e.g. orgPath("abc", "/register") → "/company/abc/register".
export function orgPath(tenantId, sub = '') {
  return `/company/${tenantId}${sub}`;
}

// Hook: the "/company/{tenantId}" base for the CURRENT signed-in user. Prepend it
// to a subpath, e.g. `${base}/dsar/${id}`.
export function useOrgBase() {
  const tenantId = useSelector((s) => s.auth.user?.tenantId);
  return `/company/${tenantId}`;
}
