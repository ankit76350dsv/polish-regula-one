import { Moon, Sun } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { selectTheme, toggleTheme } from "../../slices/uiSlice";

// A single button that flips between light and dark. The actual <html class="dark">
// switch is applied centrally in App.jsx by watching the theme in the store.
export function ThemeToggle() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => dispatch(toggleTheme())}
      aria-label={isDark ? t("nav.lightMode") : t("nav.darkMode")}
      title={isDark ? t("nav.lightMode") : t("nav.darkMode")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
    >
      {isDark ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
}
