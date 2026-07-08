// Simple footer shown at the bottom of every page.
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© {year} DSV Corporation — WasteSync (RegulaOne platform)</span>
        <span>BDO Waste & Packaging Reporting · Poland / EEA</span>
      </div>
    </footer>
  );
}
