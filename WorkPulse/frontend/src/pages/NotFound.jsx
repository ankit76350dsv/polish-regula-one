import { Link } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";
import { useOrgHome } from "../utils/paths";

export default function NotFound() {
  // t() returns the wording for the language the user picked (Polish by default).
  const { t } = useTranslation();

  // "Back" must return to the home page INSIDE the user's company
  // ("/company/{tenantId}/home"), not to the bare app root.
  const orgHome = useOrgHome();

  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      {/* "404" is a number, so it reads the same in every language. */}
      <p className="text-5xl font-extrabold text-indigo-600">404</p>
      <h1 className="text-xl font-bold text-slate-800 mt-3">{t("notFound.title")}</h1>
      <p className="text-slate-500 mt-2">{t("notFound.message")}</p>
      <Link
        to={orgHome}
        className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold"
      >
        {t("notFound.back")}
      </Link>
    </div>
  );
}
