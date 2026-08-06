import { useTranslation } from "../../hooks/useTranslation";

// Simple footer shown at the bottom of every page.
//
// WHAT CHANGED AND WHY: both lines were hard-coded English text. They now come
// from the language files, so the footer switches together with the rest of the
// app. The year is passed in as a placeholder rather than glued onto the sentence
// here, because Polish and English do not always put it in the same place.
export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>{t("footer.copyright", { year })}</span>
        <span>{t("footer.tagline")}</span>
      </div>
    </footer>
  );
}
