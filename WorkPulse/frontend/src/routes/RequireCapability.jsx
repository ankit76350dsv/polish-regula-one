import { Outlet } from "react-router-dom";
import { useCapabilities } from "../hooks/useCapabilities";

// Page-level check: "may this user open THIS page at all?"
//
// ProtectedRoute already answered "are you logged in?". This guard answers the
// next question: does this page match what your role may do?
//
// Example: an auditor may read every time record but must never see the Clock
// screen, because they do not clock in — and a normal employee must never open the
// Dashboard, which shows other people's hours. Wrapping those routes here means the
// person gets one short message instead of a page that fills with errors.
//
// Usage in the router:
//   {
//     element: <RequireCapability capability={CAPABILITIES.DASHBOARD_READ} />,
//     children: [{ path: "dashboard", element: <Dashboard /> }],
//   }
//
// Pass `capability` for one requirement, or `anyOf` for "any one of these" — used
// by pages that serve two audiences, such as Settlement (your own balance, or the
// whole tenant's report).
//
// This is about showing the right screen, not about security: every API call the
// page would make is checked again by the backend, which is what actually protects
// the data.
export default function RequireCapability({ capability, anyOf, children }) {
  const { can } = useCapabilities();

  const required = anyOf?.length ? anyOf : [capability].filter(Boolean);

  // A guard that requires nothing would let everyone in — exactly the kind of
  // quiet mistake we want to avoid — so treat it as "not allowed".
  const allowed = required.length > 0 && required.some((item) => can(item));

  if (!allowed) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-5">
          <svg
            className="w-7 h-7 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
          Not available for your role
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          This page is not part of your role
        </h1>
        <p className="text-slate-500 max-w-md">
          You have access to WorkPulse, but this page is reserved for other roles. If
          you believe you need it, please ask your administrator.
        </p>
      </div>
    );
  }

  // `children` is used when wrapping a single element; `Outlet` when this guard is
  // a parent route in the router.
  return children ?? <Outlet />;
}
