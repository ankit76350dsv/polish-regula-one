// A simple, accessible loading spinner. `label` is announced to screen readers.
export function Spinner({ size = 24, label, className = "" }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="inline-block rounded-full border-2 border-cyan-600 border-t-transparent animate-spin"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      {label ? <span className="text-sm text-slate-600">{label}</span> : null}
      <span className="sr-only">{label || "Loading"}</span>
    </span>
  );
}

// A full-area centered spinner for page-level loading states.
export function PageSpinner({ label }) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Spinner size={36} label={label} />
    </div>
  );
}
