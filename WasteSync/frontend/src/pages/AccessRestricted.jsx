import { useAuth } from "../context/AuthContext";
import { ACCESS } from "../config/moduleAccess";
import { Card, Button } from "../components/common";
import { useTranslation } from "../hooks/useTranslation";

// AccessRestricted is a full-screen "you cannot use WasteSync right now" page.
//
// It is shown by ModuleAccessGuard when a logged-in user:
//   - has had their account switched off        (variant = ACCOUNT_SUSPENDED)
//   - does NOT have WasteSync in their package  (variant = MODULE_UNAVAILABLE)
//   - has a subscription plan that has expired  (variant = PLAN_EXPIRED)
//   - was never given WasteSync themselves      (variant = PERMISSION_DENIED)
// and by RequireCapability when the user may use WasteSync but not this one page:
//   - the page is outside their role            (variant = PAGE_NOT_PERMITTED)
//
// We keep EVERY message in this one component so the look and feel stays the
// same and we only have one page to maintain. The `variant` prop decides which
// wording, icon and colour to show. We reuse the shared Card/Button so it
// matches the rest of WasteSync.

// The styling and wording SOURCE for each situation. Keeping this as a small lookup
// table (instead of lots of if/else in the JSX) makes it easy to read and to add new
// cases later if we ever need them.
//
// WHAT CHANGED AND WHY: each entry used to hold the finished English sentences
// (`eyebrow`, `title`, `message`). It now holds a `textKey` instead — the name of a
// group in the language files that carries those three sentences in every language.
//
// This page matters more than most for getting the language right. It is often the
// FIRST and ONLY screen a blocked user ever sees, and it is the screen that tells
// them what to do about it ("ask your administrator to..."). Instructions the reader
// cannot understand are the same as no instructions, so a Polish user seeing an
// English wall of text here would simply be stuck. What is NOT translated is
// deliberate too: we still never name the missing permission, in any language,
// because telling a caller exactly what they lack helps an attacker map the system.
const VARIANTS = {
  // An administrator switched this account off (/me returns "enabled": false).
  // Nothing in WasteSync works while that is the case, so the wording is final and
  // simply points the person at whoever can turn the account back on.
  [ACCESS.ACCOUNT_SUSPENDED]: {
    accent: "red",
    textKey: "access.suspended",
    // A "circle with a line through it" (no entry) icon path.
    iconPath:
      "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  },
  [ACCESS.MODULE_UNAVAILABLE]: {
    accent: "amber",
    textKey: "access.moduleUnavailable",
    // A "shield with exclamation" icon path.
    iconPath:
      "M12 9v3.75m0 3.75h.008v.008H12v-.008zM12 2.25l8.485 3.394A1.5 1.5 0 0121.75 7.05v4.95c0 5.05-3.36 9.44-8.03 10.72a2.25 2.25 0 01-1.44 0C7.61 21.44 4.25 17.05 4.25 12V7.05a1.5 1.5 0 011.265-1.406L12 2.25z",
  },
  [ACCESS.PLAN_EXPIRED]: {
    accent: "red",
    textKey: "access.planExpired",
    // A "clock" icon path.
    iconPath: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  // The company DOES have WasteSync and the plan is paid, but this user was not
  // given permission to use it. We name the person's administrator as the fix, and
  // we never say which permission is missing.
  [ACCESS.PERMISSION_DENIED]: {
    accent: "amber",
    textKey: "access.permissionDenied",
    // A "locked padlock" icon path.
    iconPath:
      "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
  },
  // This person DOES use WasteSync — they just opened a page their role does not
  // cover (for example an HR manager opening Audit Logs).
  [ACCESS.PAGE_NOT_PERMITTED]: {
    accent: "slate",
    textKey: "access.pageNotPermitted",
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
  // Neutral grey — used for "this page is not for your role", which is normal and
  // expected, not a problem the user needs to worry about.
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

  // The three sentences for this situation, in the user's language.
  const eyebrow = t(`${content.textKey}.eyebrow`);
  const title = t(`${content.textKey}.title`);
  const message = t(`${content.textKey}.message`);

  // "This page is not part of your role" is different from every other case here.
  // The other four mean the person cannot use WasteSync AT ALL, so signing out is
  // the only thing left to offer. This one appears INSIDE the app, with the menu
  // still on screen, and the user has other pages they can use — so we do not
  // stretch it over the whole screen and we do not offer to sign them out. Showing
  // a "Sign out" button here would suggest their session is the problem, when all
  // that happened is they opened one page their role does not cover.
  const isPageLevel = variant === ACCESS.PAGE_NOT_PERMITTED;

  return (
    <div
      className={
        isPageLevel
          ? "flex items-start justify-center px-4 py-10"
          : "min-h-screen flex items-center justify-center bg-slate-50 px-4"
      }
    >
      <Card className="max-w-md w-full p-8 text-center">
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
          {eyebrow}
        </p>

        <h1 className="text-2xl font-bold text-slate-900 mb-4">{title}</h1>

        <p className="text-slate-500 mb-6">{message}</p>

        {/* Show which account this is, so an admin can help faster. This is only
            the email the user already knows — no sensitive data. */}
        {user?.email && (
          <p className="text-sm text-slate-400 mb-6">
            {t("access.signedInAs")}{" "}
            <span className="text-slate-600 font-medium">{user.email}</span>
          </p>
        )}

        {/* For the account-level cases the only action we can safely offer is to
            sign out and go back to the central login page (logout() clears the
            shared auth cookie). For a blocked PAGE we offer nothing, because the
            menu is still there and the user simply picks another page. */}
        {!isPageLevel && (
          <Button variant="secondary" onClick={logout}>
            {t("access.signOut")}
          </Button>
        )}
      </Card>
    </div>
  );
}
