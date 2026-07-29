import { Lock, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { NAV_ITEMS, PAGE_ROLES_REQUIRED } from '../../constants/navigation';

// ── Sidebar ───────────────────────────────────────────────────────────────────
// The left-hand navigation rail. It only draws the menu and shows the active
// tenant — it owns no data. Everything it needs (the active section, the live
// badge counts, the collapse/mobile flags) is passed in as props by Workspace.
//
// Props:
//   tenant          → the active organisation (name / NIP / plan), shown at the top.
//   role            → the current user's role; used to lock pages they cannot open.
//   currentSection  → which page is open, so the matching link is highlighted.
//   offlineCount    → invoices stuck offline → shown as a red badge on "Offline Queue".
//   hubUnread       → unread notifications → shown as a red badge on "Notifications".
//   collapsed       → desktop: show the narrow icon-only rail.
//   mobileOpen      → mobile: slide the drawer in.
//   onToggleCollapse→ collapse / expand the desktop rail.
//   onCloseMobile   → close the mobile drawer.
//   onNavigate      → go to a section (e.g. onNavigate('invoices')).
export default function Sidebar({
  tenant,
  role,
  currentSection,
  offlineCount = 0,
  hubUnread = 0,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onNavigate,
}) {
  const { language, t } = useLanguage();

  // Pick the red badge (if any) for a given link. Returns null when there is
  // nothing to show, so links stay clean unless there is something to flag.
  const badgeFor = (badge) => {
    const count = badge === 'offline' ? offlineCount : badge === 'hubUnread' ? hubUnread : 0;
    if (!count) return null;
    return (
      <span className="bg-red-600 text-white font-bold font-mono text-[9px] px-1.5 py-0.5 rounded-full">
        {count}
      </span>
    );
  };

  // Draw a single navigation link. Pulled out so every link looks identical.
  const renderNavItem = ({ section, labelKey, Icon, badge }) => {
    // Notifications has no sidebar translation key — fall back to a hard-coded label.
    const label = labelKey
      ? t(labelKey)
      : language === 'pl' ? 'Powiadomienia' : 'Notifications';
    const isActive = currentSection === section;
    const allowed = PAGE_ROLES_REQUIRED[section]?.includes(role);

    return (
      <button
        key={section}
        type="button"
        title={collapsed ? label : undefined}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onNavigate(section)}
        className={`group relative w-full rounded-lg py-2.5 text-left text-xs font-semibold transition cursor-pointer ${
          collapsed ? 'px-3 md:flex md:items-center md:justify-center md:px-2' : 'px-3'
        } ${
          isActive
            ? 'bg-slate-100 text-slate-900 border-l-2 border-red-600 rounded-l-none'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        }`}
      >
        <span className={`flex min-w-0 items-center gap-3 ${collapsed ? 'md:justify-center' : 'justify-between'}`}>
          <span className="flex min-w-0 items-center gap-3">
            <Icon size={16} className="shrink-0" />
            <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
          </span>
          <span className={`flex shrink-0 items-center gap-1.5 ${collapsed ? 'md:absolute md:right-1 md:top-1' : ''}`}>
            {!allowed && <Lock size={11} className="text-slate-400" />}
            {badgeFor(badge)}
          </span>
        </span>
      </button>
    );
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-80 max-w-[86vw] shrink-0 transform flex-col border-r border-slate-200 bg-white font-sans shadow-2xl shadow-slate-900/15 transition-all duration-300 ease-out md:sticky md:top-0 md:z-30 md:max-w-none md:translate-x-0 md:shadow-none ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } ${collapsed ? 'md:w-20' : 'md:w-72'}`}
    >
      {/* Brand header + collapse / close controls */}
      <div className={`flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4 ${collapsed ? 'md:justify-center md:px-3' : 'justify-between'}`}>
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'md:justify-center' : ''}`}>
          <div className="bg-red-700 text-white rounded-lg p-1.5 font-sans font-black flex items-center justify-center text-sm shadow-xs leading-none shrink-0">
            R1
          </div>
          <div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold text-[15px] tracking-tight text-slate-800 uppercase">RegulaOne</span>
              <span className="text-[11px] bg-red-50 text-red-650 px-1.5 py-0.5 rounded font-mono font-bold leading-none">KSeFFlow</span>
            </div>
            <p className="truncate text-[10px] text-slate-400 font-medium">Poland e-Invoicing Compliance SaaS Node</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:hidden"
            aria-label="Close sidebar"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Active tenant card + the navigation links */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          <div className={`bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs shadow-xs ${collapsed ? 'md:hidden' : ''}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{t('sidebar.tenantVault')}</span>
            <p className="font-semibold text-slate-700 truncate text-[11.5px] mt-1">{tenant.name}</p>
            <div className="flex justify-between gap-2 text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-100">
              <span className="min-w-0 truncate">{t('sidebar.nip')}: <strong className="text-slate-600">{tenant.nip}</strong></span>
              <span className="text-emerald-600 font-bold shrink-0">{tenant.subscriptionPlan}</span>
            </div>
          </div>

          <nav className="space-y-1" aria-label="KSeFFlow sections">
            {NAV_ITEMS.map(renderNavItem)}
          </nav>
        </div>
      </div>

      {/* Platform status footer */}
      <div className={`shrink-0 border-t border-slate-100 p-4 text-[10.5px] text-slate-400 ${collapsed ? 'md:px-3' : ''}`}>
        <div className={`space-y-1 ${collapsed ? 'md:hidden' : ''}`}>
          <p>{t('header.platformStatus')}: <strong>SECURE RODO_OK</strong></p>
          <p>{t('header.database')}: <strong>Postgres schemas</strong></p>
          <p className="truncate">{t('header.sla')}: <strong>Frankfurt AWS</strong></p>
        </div>
        <div className={`hidden ${collapsed ? 'md:flex' : ''} justify-center`}>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" title="Platform secure" />
        </div>
      </div>
    </aside>
  );
}
