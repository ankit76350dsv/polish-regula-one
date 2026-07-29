/**
 * CookieBanner — a one-time informational notice.
 *
 * SafeVoice uses ONLY strictly necessary storage (a secure session cookie and a
 * language/theme preference). Under the ePrivacy Directive that does NOT require
 * opt-in consent, so this banner only INFORMS and offers a link to the cookie
 * policy — it never blocks the page and there is no "reject" because there is
 * nothing non-essential to reject. If analytics is ever added, this must become a
 * real consent gate.
 */
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Cookie } from "lucide-react";
import { acknowledgeCookies, selectCookieAcknowledged } from "../../slices/consentSlice";

export function CookieBanner({ navigate }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const acknowledged = useSelector(selectCookieAcknowledged);

  if (acknowledged) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[90] p-3 md:p-4"
      role="region"
      aria-label={t("footer.cookies")}
    >
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl shadow-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Cookie className="w-5 h-5 text-cyan-600 shrink-0" aria-hidden="true" />
        <p className="text-xs text-slate-600 flex-1 leading-relaxed">{t("cookieBanner.message")}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/cookies")}
            className="text-xs font-semibold text-cyan-700 hover:underline px-2 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
          >
            {t("cookieBanner.learnMore")}
          </button>
          <button
            type="button"
            onClick={() => dispatch(acknowledgeCookies())}
            className="text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {t("cookieBanner.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
