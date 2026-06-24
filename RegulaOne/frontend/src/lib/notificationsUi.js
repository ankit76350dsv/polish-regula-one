// Small presentation helpers shared by the bell and the notification pages.

// Severity → badge/dot styling (matches the app's slate/red palette).
export const SEVERITY_STYLES = {
  CRITICAL: { dot: 'bg-red-600',     chip: 'bg-red-50 text-red-700 border-red-200' },
  ERROR:    { dot: 'bg-rose-500',    chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  WARNING:  { dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUCCESS:  { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INFO:     { dot: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export const severityStyle = (severity) => SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.INFO;

// "just now" / "5m ago" / "3h ago" / "2d ago" / a date for older items.
export function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
