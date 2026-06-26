/**
 * PublicLayout — the chrome for everything an anonymous reporter sees: the report
 * form, tracking, and all legal/compliance pages. It deliberately has NO staff
 * sidebar, NO signed-in user, and NO SSO session — only a light header (logo,
 * compliance badges, language + theme controls) and the shared footer. This keeps
 * the whistleblower surface completely free of anything tied to a logged-in user
 * (anonymity requirement of EU 2019/1937 and the Polish 2024 Act).
 */
import { Lock, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher, ThemeToggle } from "../ui";
import { SiteFooter } from "./SiteFooter";

export function PublicLayout({ navigate, currentPath, children }) {
  const { t } = useTranslation();

  const topLinks = [
    ["/report", t("nav.submitReport")],
    ["/track", t("nav.trackReport")],
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:bg-cyan-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
      >
        Skip to content
      </a>

      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate("/report")}
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
              {topLinks.map(([path, label]) => {
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
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      active
                        ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                        : "text-slate-700 hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    {label}
                  </a>
                );
              })}
            </nav>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 md:py-8">{children}</div>
      </main>

      <SiteFooter navigate={navigate} />
    </div>
  );
}
