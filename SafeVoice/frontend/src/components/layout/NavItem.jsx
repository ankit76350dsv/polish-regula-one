import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { selectMyOrg } from "../../slices/orgSlice";
import { toBrowserPath, toPublicReportPath } from "../../utils/routing";

// A single clickable navigation link. Shows an icon + translated label and
// highlights itself on the active page. The visible href is the real address-bar
// URL so right-click / open-in-new-tab works correctly.
export function NavItem({ item, currentPath, navigate, compact = false, tenantId }) {
  const { t } = useTranslation();
  const org = useSelector(selectMyOrg);
  const Icon = item.icon;
  const label = t(item.labelKey);

  // The "Submit report" link opens the anonymous portal in a new tab.
  const opensReportTab = item.newTab && Boolean(tenantId);

  const isActive =
    !opensReportTab &&
    (item.path === "/cases"
      ? currentPath === "/cases" || currentPath.startsWith("/cases/")
      : currentPath === item.path || currentPath.startsWith(`${item.path}/`));

  return (
    <a
      href={opensReportTab ? toPublicReportPath(tenantId, org?.name) : toBrowserPath(item.path, tenantId)}
      {...(opensReportTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={(event) => {
        if (opensReportTab) return;
        event.preventDefault();
        navigate(item.path);
      }}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
        isActive
          ? "border-cyan-200 bg-cyan-50 text-cyan-700"
          : "border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
      } ${compact ? "justify-center" : ""}`}
      title={label}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      {!compact && <span className="truncate">{label}</span>}
      {item.count && !compact && (
        <span className="ml-auto rounded bg-cyan-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{item.count}</span>
      )}
    </a>
  );
}
