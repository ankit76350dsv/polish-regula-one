import { useId } from "react";
import { useTranslation } from "react-i18next";

export function SecureTextField({
  label,
  helperText,
  icon,
  className = "",
  id,
  ...props
}) {
  const { t } = useTranslation();
  const generatedId = useId();
  const fieldId = id || generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-xs font-semibold text-slate-700 flex items-center justify-between"
        >
          <span>{label}</span>
          {props.required && (
            <span className="text-cyan-600 font-mono text-[10px] uppercase">
              {t("common.required")}
            </span>
          )}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            {icon}
          </div>
        )}
        <input
          id={fieldId}
          aria-describedby={helperId}
          className={`block w-full rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 py-2.5 ${
            icon ? "pl-10" : "pl-3.5"
          } pr-3.5 transition-colors`}
          {...props}
        />
      </div>
      {helperText && (
        <p id={helperId} className="text-[11px] text-slate-500 leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
}
