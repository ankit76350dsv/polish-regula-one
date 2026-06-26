// The drop-down menu shown on small screens when the menu button is tapped.
// Lists every link (public + staff). Hidden entirely when closed.
import { useTranslation } from "react-i18next";
import { publicRoutes, staffRoutes } from "./navRoutes";
import { toBrowserPath, toPublicReportPath } from "../../utils/routing";

export function MobileNavigation({ currentPath, navigate, open, close, tenantId }) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[...publicRoutes, ...staffRoutes].map((item) => {
          const opensReportTab = item.newTab && Boolean(tenantId);
          const Icon = item.icon;
          return (
            <a
              key={item.path}
              href={opensReportTab ? toPublicReportPath(tenantId) : toBrowserPath(item.path, tenantId)}
              {...(opensReportTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={(event) => {
                if (opensReportTab) {
                  close();
                  return;
                }
                event.preventDefault();
                navigate(item.path);
                close();
              }}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs font-semibold ${
                currentPath === item.path
                  ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {t(item.labelKey)}
            </a>
          );
        })}
      </div>
    </div>
  );
}
