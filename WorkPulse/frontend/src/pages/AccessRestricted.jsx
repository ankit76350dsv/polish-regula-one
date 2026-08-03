import { useAuth } from "../context/AuthContext";
import { ACCESS } from "../config/moduleAccess";
import { useTranslation } from "../hooks/useTranslation";

// AccessRestricted is a full-screen "you cannot use WorkPulse right now" page.
//
// It is shown by ModuleAccessGuard when a logged-in user either:
//   - has had their account switched off        (variant = ACCOUNT_SUSPENDED)
//   - does NOT have WorkPulse in their package  (variant = MODULE_UNAVAILABLE)
//   - has a subscription plan that has expired  (variant = PLAN_EXPIRED)
//   - was never granted WorkPulse               (variant = PERMISSION_DENIED)
// and by RequireCapability when they open a page their role does not cover
//   (variant = PAGE_NOT_PERMITTED).
//
// We keep ALL the messages in this one component so the look and feel stays the
// same and we only have one page to maintain. The `variant` prop decides which
// wording, icon and colour to show.
//
// This mirrors safeWork/frontend/src/pages/AccessRestricted.jsx, including the
// wording, so a user moving between the two apps sees one consistent platform.
//
// Note the table stores translation KEYS (for example "access.planTitle") and not
// finished sentences. The component turns each key into real words with t(), so
// the same table serves both Polish and English. The words themselves live in
// src/i18n/pl.js and src/i18n/en.js.
const VARIANTS = {
  // An administrator switched this account off (/me returns "enabled": false).
  // Nothing in WorkPulse works while that is the case, so the wording is final
  // and simply points the person at whoever can turn the account back on.
  [ACCESS.ACCOUNT_SUSPENDED]: {
    accent: "red",
    eyebrowKey: "access.suspendedEyebrow",
    titleKey: "access.suspendedTitle",
    messageKey: "access.suspendedMessage",
    // A "circle with a line through it" (no entry) icon path.
    iconPath:
      "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  },
  // The tenant never bought this module, so there is nothing to show at all.
  [ACCESS.MODULE_UNAVAILABLE]: {
    accent: "amber",
    eyebrowKey: "access.moduleEyebrow",
    titleKey: "access.moduleTitle",
    messageKey: "access.moduleMessage",
    // A "shield with exclamation" icon path.
    iconPath:
      "M12 9v3.75m0 3.75h.008v.008H12v-.008zM12 2.25l8.485 3.394A1.5 1.5 0 0121.75 7.05v4.95c0 5.05-3.36 9.44-8.03 10.72a2.25 2.25 0 01-1.44 0C7.61 21.44 4.25 17.05 4.25 12V7.05a1.5 1.5 0 011.265-1.406L12 2.25z",
  },
  // The subscription has run out. Different from "not in your plan": here the
  // fix is renewing, not buying a new module.
  [ACCESS.PLAN_EXPIRED]: {
    accent: "red",
    eyebrowKey: "access.planEyebrow",
    titleKey: "access.planTitle",
    messageKey: "access.planMessage",
    // A "clock" icon path.
    iconPath: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  // The company DOES have WorkPulse and the plan is paid, but this user was not
  // given permission to use it. We name the person's administrator as the fix,
  // and we never say which permission is missing — that is internal detail that
  // would help someone map the system.
  [ACCESS.PERMISSION_DENIED]: {
    accent: "amber",
    eyebrowKey: "access.permissionEyebrow",
    titleKey: "access.permissionTitle",
    messageKey: "access.permissionMessage",
    // A "locked padlock" icon path.
    iconPath:
      "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
  },
  // This person DOES use WorkPulse — they just opened a page their role does not
  // cover (for example an auditor opening the Clock screen). This is normal and
  // expected, so the colour is neutral grey rather than a warning colour.
  [ACCESS.PAGE_NOT_PERMITTED]: {
    accent: "slate",
    eyebrowKey: "access.pageEyebrow",
    titleKey: "access.pageTitle",
    messageKey: "access.pageMessage",
    // An "eye with a line through it" icon path.
    iconPath:
      "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88",
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
  // Neutral grey — used for "this page is not for your role", which is normal
  // and expected, not a problem the user needs to worry about.
  slate: {
    ring: "bg-slate-50 border-slate-200 shadow-slate-500/10",
    icon: "text-slate-500",
    eyebrow: "text-slate-500",
  },
};

export default function AccessRestricted({ variant }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  // If an unknown variant is passed, fall back to the "module unavailable"
  // message so the user always sees something sensible.
  const content = VARIANTS[variant] ?? VARIANTS[ACCESS.MODULE_UNAVAILABLE];
  const accent = ACCENT_CLASSES[content.accent] ?? ACCENT_CLASSES.amber;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-slate-50">
      {/* Coloured icon badge that matches the situation (amber / red / grey). */}
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
        {t(content.eyebrowKey)}
      </p>

      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
        {t(content.titleKey)}
      </h1>

      <p className="text-slate-500 max-w-md mb-8">{t(content.messageKey)}</p>

      {/* Show which account this is, so an admin can help faster. This is only
          the email the user already knows — no sensitive data. */}
      {user?.email && (
        <p className="text-sm text-slate-400 mb-8">
          {t("access.signedInAs")}{" "}
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
        {t("common.signOut")}
      </button>
    </div>
  );
}
