/**
 * Shared footer with the legally required links (privacy, terms, cookies,
 * accessibility) plus the "how reports are handled" and external-reporting pages.
 * Present on every public page so these notices are always one click away — a
 * core GDPR transparency and EU Whistleblower Directive expectation.
 */
import { useTranslation } from "react-i18next";

export function SiteFooter({ navigate }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const links = [
    ["/privacy", t("footer.privacy")],
    ["/how-it-works", t("footer.howItWorks")],
    ["/external-reporting", t("footer.externalReporting")],
    ["/terms", t("footer.terms")],
    ["/cookies", t("footer.cookies")],
    ["/accessibility", t("footer.accessibility")],
  ];

  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-3">
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold" aria-label={t("footer.privacy")}>
          {links.map(([path, label]) => (
            <a
              key={path}
              href={path}
              onClick={(e) => {
                e.preventDefault();
                navigate(path);
              }}
              className="text-slate-600 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
            >
              {label}
            </a>
          ))}
        </nav>
        <p className="text-[11px] text-slate-500">{t("footer.controllerLine")}</p>
        <p className="text-[11px] text-slate-400">{t("footer.rights", { year })}</p>
      </div>
    </footer>
  );
}
