/**
 * ToastHost — renders the small confirmation/error messages from the ui slice.
 *
 * Mounted once near the app root. Each toast auto-dismisses after a few seconds,
 * is announced to screen readers via an aria-live region, and can be dismissed
 * manually. This is how the app gives feedback after an action (WCAG 4.1.3).
 */
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { removeToast, selectToasts } from "../../slices/uiSlice";

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const TONES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-cyan-200 bg-cyan-50 text-cyan-800",
};

function Toast({ toast, onClose }) {
  const reduce = useReducedMotion();
  const Icon = ICONS[toast.type] || Info;

  useEffect(() => {
    // Persistent toasts stay until the user dismisses them with the close (X) button.
    if (toast.persistent) return undefined;
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [onClose, toast.persistent]);

  return (
    <motion.div
      layout
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
      className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 shadow-lg text-sm ${TONES[toast.type] || TONES.info}`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 text-current/70 hover:text-current rounded focus:outline-none focus:ring-2 focus:ring-current"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export function ToastHost() {
  const dispatch = useDispatch();
  const toasts = useSelector(selectToasts);

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,22rem)] pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => dispatch(removeToast(toast.id))} />
        ))}
      </AnimatePresence>
    </div>
  );
}
