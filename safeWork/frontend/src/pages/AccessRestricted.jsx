import { useAuth } from "../context/AuthContext";
import { ACCESS } from "../config/moduleAccess";

// AccessRestricted is a full-screen "you cannot use SafeWork right now" page.
//
// It is shown by ModuleAccessGuard when a logged-in user either:
//   - does NOT have SafeWork in their package  (variant = MODULE_UNAVAILABLE)
//   - has a subscription plan that has expired  (variant = PLAN_EXPIRED)
//
// We keep BOTH messages in this one component so the look and feel stays the
// same and we only have one page to maintain. The `variant` prop decides which
// wording, icon and colour to show.

// The text and styling for each situation. Keeping this as a small lookup table
// (instead of lots of if/else in the JSX) makes it easy to read and to add new
// cases later if we ever need them.
const VARIANTS = {
  [ACCESS.MODULE_UNAVAILABLE]: {
    accent: "amber",
    eyebrow: "Access Restricted",
    title: "SafeWork is not part of your plan",
    // Simple, friendly explanation for the user.
    message:
      "Your account does not include the SafeWork module. Please contact your administrator to have SafeWork added to your organisation's subscription.",
    // A "shield with exclamation" icon path.
    iconPath:
      "M12 9v3.75m0 3.75h.008v.008H12v-.008zM12 2.25l8.485 3.394A1.5 1.5 0 0121.75 7.05v4.95c0 5.05-3.36 9.44-8.03 10.72a2.25 2.25 0 01-1.44 0C7.61 21.44 4.25 17.05 4.25 12V7.05a1.5 1.5 0 011.265-1.406L12 2.25z",
  },
  [ACCESS.PLAN_EXPIRED]: {
    accent: "red",
    eyebrow: "Subscription Expired",
    title: "Your plan has expired",
    message:
      "Your organisation's subscription has ended, so SafeWork is temporarily locked. Please contact your administrator to renew the plan and restore access.",
    // A "clock" icon path.
    iconPath: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

// Tailwind class sets per accent colour. We list full class names (not built by
// string concatenation) because Tailwind only keeps classes it can see written
// out in full.
const ACCENT_CLASSES = {
  amber: {
    ring: "bg-amber-50 border-amber-200 shadow-amber-500/10",
    icon: "text-amber-600",
    eyebrow: "text-amber-600",
  },
  red: {
    ring: "bg-red-50 border-red-200 shadow-red-500/10",
    icon: "text-red-600",
    eyebrow: "text-red-600",
  },
};

export default function AccessRestricted({ variant }) {
  const { user, logout } = useAuth();

  // If an unknown variant is passed, fall back to the "module unavailable"
  // message so the user always sees something sensible.
  const content = VARIANTS[variant] ?? VARIANTS[ACCESS.MODULE_UNAVAILABLE];
  const accent = ACCENT_CLASSES[content.accent] ?? ACCENT_CLASSES.amber;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-slate-50">
      {/* Coloured icon badge that matches the situation (amber / red). */}
      <div
        className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-6 shadow-sm ${accent.ring}`}
      >
        <svg
          className={`w-8 h-8 ${accent.icon}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={content.iconPath}
          />
        </svg>
      </div>

      <p
        className={`text-xs font-semibold tracking-widest uppercase mb-3 ${accent.eyebrow}`}
      >
        {content.eyebrow}
      </p>

      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
        {content.title}
      </h1>

      <p className="text-slate-500 max-w-md mb-8">{content.message}</p>

      {/* Show which account this is, so an admin can help faster. This is only
          the name/email the user already knows — no sensitive data. */}
      {user?.email && (
        <p className="text-sm text-slate-400 mb-8">
          Signed in as{" "}
          <span className="text-slate-600 font-medium">{user.email}</span>
        </p>
      )}

      {/* The only action we can safely offer here is to sign out and go back to
          the central login page. logout() clears the shared auth cookie. */}
      <button
        type="button"
        onClick={logout}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-100 hover:border-slate-300 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
          />
        </svg>
        Sign out
      </button>
    </div>
  );
}
