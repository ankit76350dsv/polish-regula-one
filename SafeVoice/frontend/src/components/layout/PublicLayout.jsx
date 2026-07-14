/**
 * PublicLayout — the chrome for everything an anonymous reporter sees: the report
 * form, tracking, and all legal/compliance pages. It deliberately has NO staff
 * sidebar, NO signed-in user, and NO SSO session — only a light header (logo,
 * compliance badges, language + theme controls) and the shared footer. This keeps
 * the whistleblower surface completely free of anything tied to a logged-in user
 * (anonymity requirement of EU 2019/1937 and the Polish 2024 Act).
 *
 * The header and footer live with the other public pages, in src/pages/public.
 * They are imported by their file path (not the pages/public barrel) to avoid a
 * circular import, because that barrel's pages import this layout back.
 */
import { PublicHeader } from "../../pages/public/PublicHeader";
import { PublicFooter } from "../../pages/public/PublicFooter";

export function PublicLayout({ navigate, currentPath, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:bg-cyan-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
      >
        Skip to content
      </a>

      <PublicHeader navigate={navigate} currentPath={currentPath} />

      <main id="main-content" className="flex-1">
        <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 md:py-8">{children}</div>
      </main>

      <PublicFooter navigate={navigate} />
    </div>
  );
}
