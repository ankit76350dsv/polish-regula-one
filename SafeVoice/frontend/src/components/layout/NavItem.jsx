// A single clickable navigation link.
// It shows an icon, a label, and (sometimes) a small count badge.
// It also highlights itself when the user is on its page.
export function NavItem({ item, currentPath, navigate, compact = false }) {
  const Icon = item.icon;

  // Work out if this link points to the page the user is looking at now.
  // The "/cases" link also stays active on detail pages like "/cases/123".
  const isActive =
    item.path === "/cases"
      ? currentPath === "/cases" || currentPath.startsWith("/cases/")
      : currentPath === item.path || currentPath.startsWith(`${item.path}/`);

  return (
    <a
      href={item.path}
      onClick={(event) => {
        event.preventDefault();
        navigate(item.path);
      }}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
        isActive
          ? "border-cyan-200 bg-cyan-50 text-cyan-700"
          : "border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
      } ${compact ? "justify-center" : ""}`}
      title={item.label}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      {!compact && <span className="truncate">{item.label}</span>}
      {item.count && !compact && (
        <span className="ml-auto rounded bg-cyan-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
          {item.count}
        </span>
      )}
    </a>
  );
}
