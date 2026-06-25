import { Bell, Languages, LogOut, Menu } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

// ── Header ────────────────────────────────────────────────────────────────────
// The top bar of the workspace. It holds the mobile menu button, the language
// switch, the notifications bell (with its dropdown) and the user/profile block.
// Like the Sidebar it owns no data — Workspace passes everything in.
//
// Props:
//   user                 → the signed-in user (name / email / initials).
//   tenant               → the active organisation (shown under the title).
//   notifications        → already-merged + sorted list shown in the bell dropdown.
//   unreadCount          → number shown in the little red bubble on the bell.
//   showNotifications    → whether the bell dropdown is currently open.
//   onToggleNotifications→ open / close the bell dropdown (and mark read on open).
//   onOpenMobileSidebar  → open the sidebar drawer on small screens.
//   onNavigate           → go to a section (used by "View all notifications" / profile).
//   onLogout             → sign the user out of the shared SSO session.
export default function Header({
  user,
  tenant,
  notifications,
  unreadCount,
  showNotifications,
  onToggleNotifications,
  onOpenMobileSidebar,
  onNavigate,
  onLogout,
}) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="bg-white border-b border-slate-200 h-16 px-4 sm:px-6 flex shrink-0 items-center justify-between z-30">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
          aria-label="Open sidebar"
        >
          <Menu size={17} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-tight text-slate-800">KSeFFlow Workspace</p>
          <p className="truncate text-[10px] font-medium text-slate-400">{tenant.name || 'My Organisation'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'pl' : 'en')}
          className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-slate-500 border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xs shadow-xs"
          title={language === 'en' ? 'Przełącz na język polski' : 'Switch to English'}
        >
          <Languages size={14} className="text-slate-400" />
          <span className="text-[10px] text-slate-650 tracking-wide font-mono font-bold">{language.toUpperCase()}</span>
        </button>

        {/* Notifications bell + dropdown */}
        <div className="relative">
          <button
            onClick={onToggleNotifications}
            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2.5 w-85 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4 space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center border-b pb-2 border-slate-100">
                <strong className="text-slate-800 font-bold text-xs uppercase tracking-wide">{t('header.signals')}</strong>
                <button onClick={onToggleNotifications} className="text-slate-400 hover:text-slate-700 text-[10px] cursor-pointer">{t('common.close')}</button>
              </div>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-150 leading-relaxed">
                    <div className="flex justify-between font-semibold text-[11px]">
                      <span className={notif.type === 'error' ? 'text-red-650' : 'text-slate-705'}>{notif.title}</span>
                      <span className="text-[9px] text-slate-400">{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">{notif.message}</p>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-center text-slate-400 py-6">{t('header.clearSignals')}</p>
                )}
              </div>
              <div className="border-t border-slate-100 pt-2">
                <button
                  onClick={() => onNavigate('notifications')}
                  className="w-full text-center text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                >
                  {language === 'pl' ? 'Zobacz wszystkie powiadomienia' : 'View all notifications'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User identity + sign out */}
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <button
              onClick={() => onNavigate('profile')}
              title={language === 'pl' ? 'Zobacz profil' : 'View profile'}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <span className="h-8 w-8 rounded-full bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                {(user.name || '').trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '—'}
              </span>
              <span className="hidden lg:block text-right">
                <span className="block text-xs font-black text-slate-800 leading-tight group-hover:text-red-700 transition">{user.name}</span>
                <span className="block text-[10px] font-mono text-slate-400 leading-none mt-0.5">{user.email}</span>
              </span>
            </button>
            <button
              onClick={onLogout}
              title={t('header.signOut')}
              className="p-2 hover:bg-red-50 hover:text-red-700 text-slate-500 rounded-xl transition border border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
