import { Link } from "react-router-dom";
import { useTranslation } from "../../hooks/useTranslation";

export default function Footer() {
  // t() returns the wording for the language the user picked (Polish by default).
  const { t } = useTranslation();

  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-emerald-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-slate-500 text-sm">{t("footer.rights")}</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-400">
            <Link to="/privacy" className="hover:text-emerald-600 transition-colors">{t("footer.privacy")}</Link>
            <Link to="/terms"   className="hover:text-emerald-600 transition-colors">{t("footer.terms")}</Link>
            <Link to="/contact" className="hover:text-emerald-600 transition-colors">{t("footer.contact")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
