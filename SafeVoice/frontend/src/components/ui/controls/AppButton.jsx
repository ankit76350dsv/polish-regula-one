export function AppButton({
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  ...props
}) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-cyan-600 hover:bg-cyan-700 text-white focus:ring-cyan-500",
    secondary:
      "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 focus:ring-slate-500",
    outline:
      "bg-transparent border border-slate-300 hover:bg-slate-50 text-slate-700 focus:ring-slate-500",
    danger:
      "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 focus:ring-rose-500",
    secure:
      "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 focus:ring-emerald-500",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
