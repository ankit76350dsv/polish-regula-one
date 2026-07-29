import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SecureCard({
  children,
  title,
  subtitle,
  isEncrypted = false,
  className = "",
  headerAction,
}) {
  const { t } = useTranslation();
  return (
    <section
      className={`bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs relative ${className}`}
    >
      {isEncrypted && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-500/70" />
      )}
      {(title || subtitle || isEncrypted) && (
        <div className="border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                {title}
                {isEncrypted && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    <Lock className="w-3 h-3" /> {t("common.confidential")}
                  </span>
                )}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
