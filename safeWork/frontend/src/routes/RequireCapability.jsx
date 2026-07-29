import { Outlet } from "react-router-dom";
import { useCapabilities } from "../hooks/useCapabilities";
import AccessRestricted from "../pages/AccessRestricted";
import { ACCESS } from "../config/moduleAccess";

// Page-level check: "may this user open THIS page at all?"
//
// ModuleAccessGuard already answered the bigger questions (is SafeWork in your
// package, is the plan paid, were you given SafeWork at all). This guard answers
// the last one: does this particular page match what you may do?
//
// Example: an HR manager may edit employee records, but must NOT open the Audit
// Reports page (reading the audit trail is the auditor's job). Wrapping that
// route in this guard means HR sees one clear message instead of an empty page
// full of failed requests.
//
// Usage in the router:
//   {
//     element: <RequireCapability capability={CAPABILITIES.AUDIT_READ} />,
//     children: [{ path: "audit-logs", element: <AuditReport /> }],
//   }
//
// Pass `capability` for one requirement, or `anyOf` for "any one of these".
//
// This is about showing the right screen, not about security: every API call the
// page would make is checked again by the backend, which is what actually
// protects the data.
export default function RequireCapability({ capability, anyOf, children }) {
  const { can } = useCapabilities();

  // Build the list of capabilities that would let this page open.
  const required = anyOf?.length ? anyOf : [capability].filter(Boolean);

  // A guard that requires nothing would let everyone in, which is exactly the
  // kind of quiet mistake we want to avoid — so treat it as "not allowed".
  const allowed = required.length > 0 && required.some((item) => can(item));

  if (!allowed) {
    // A different message from "you have no SafeWork access": this user DOES use
    // SafeWork, just not this particular page.
    return <AccessRestricted variant={ACCESS.PAGE_NOT_PERMITTED} />;
  }

  // `children` is used when wrapping a single element directly; `Outlet` is used
  // when this guard is a parent route in the router.
  return children ?? <Outlet />;
}
