import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { AppNavbar, AppSidebar } from "../components/Navigation";

export default function SafeVoiceLayout({
  activeRole,
  children,
  currentPath,
  messagesCount,
  navigateTo,
  setRole,
}) {
  const { t } = useTranslation();
  const showPublicAccessDeniedBanner =
    activeRole === "Public User" && currentPath === "/access-denied";

  return (
    <div className="bg-slate-50 text-slate-900 font-sans min-h-screen flex antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:bg-cyan-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
      >
        {t("common.skipToContent")}
      </a>

      <AppSidebar
        currentPath={currentPath}
        onNavigate={navigateTo}
        activeRole={activeRole}
        setActiveRole={setRole}
        unreadCount={messagesCount}
      />

      <div className="flex-grow flex flex-col min-h-screen overflow-x-hidden">
        <AppNavbar
          activeRole={activeRole}
          setActiveRole={setRole}
          currentPath={currentPath}
          onNavigate={navigateTo}
        />

        {showPublicAccessDeniedBanner && (
          <div
            className="bg-amber-50 border-b border-amber-250 px-6 py-2.5 text-xs text-amber-850 flex items-center gap-2"
            role="status"
          >
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            {t("accessDenied.staffBanner")}
          </div>
        )}

        <main
          id="main-content"
          className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
