/**
 * PublicHeader — the light top bar shown on every anonymous reporter page (the
 * report form, tracking, and the legal/compliance pages). It has the home/logo
 * button, the Submit/Track links, and the language switcher.
 *
 * It deliberately carries NO signed-in user, NO session, and NO staff navigation,
 * so the whistleblower surface stays free of anything tied to a logged-in user
 * (an anonymity requirement of EU 2019/1937 and the Polish 2024 Act).
 */
import { Lock, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/ui";

export function PublicHeader({ navigate, currentPath }) {
  const { t } = useTranslation();

  const topLinks = [
    ["/report", t("nav.submitReport")],
    ["/track", t("nav.trackReport")],
  ];

  // Render one header link. The same renderer is used by the inline nav (tablet /
  // desktop) and the stacked mobile nav, so both always stay in step. `block` makes
  // the link fill its share of the row with a larger tap target for touch screens.
  const renderLink = ([path, label], block = false) => {
    const active = currentPath === path;
    return (
      <a
        key={path}
        href={path}
        onClick={(e) => {
          e.preventDefault();
          navigate(path);
        }}
        aria-current={active ? "page" : undefined}
        className={`rounded-lg px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
          block ? "flex-1 text-center py-2.5" : "py-1.5"
        } ${
          active
            ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
            : "text-slate-700 hover:bg-slate-50 border border-transparent"
        }`}
      >
        {label}
      </a>
    );
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
          >
            <Shield className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="font-bold text-sm tracking-widest text-slate-900 uppercase">
              {t("common.appName")}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 ml-1">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              {t("report.anonymousTitle")}
            </span>
          </button>

          <div className="flex items-center gap-2 md:gap-4">
            <nav className="hidden sm:flex items-center gap-1" aria-label={t("nav.publicPages")}>
              {topLinks.map((link) => renderLink(link))}
            </nav>
            <LanguageSwitcher />
          </div>
        </div>

        {/* On phones the inline nav above is hidden, so the same links sit on their own
            full-width row here with larger tap targets. */}
        <nav className="sm:hidden flex items-stretch gap-2 pb-3" aria-label={t("nav.publicPages")}>
          {topLinks.map((link) => renderLink(link, true))}
        </nav>
      </div>
    </header>
  );
}
