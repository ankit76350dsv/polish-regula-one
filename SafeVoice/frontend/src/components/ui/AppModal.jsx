import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ShieldCheck, X } from "lucide-react";

export function AppModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef(null);
  // Remember what was focused before the dialog opened so we can give focus back on close.
  const previouslyFocused = useRef(null);
  const motionProps = (props) => {
    if (!prefersReducedMotion) return props;
    return {
      initial: false,
      animate: props.animate ?? {},
      exit: props.exit ? {} : undefined,
      transition: { duration: 0 },
    };
  };

  // When the dialog opens: remember focus, move focus inside, and lock background scroll.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    // Esc closes the dialog; Tab is trapped so focus never leaves it (WCAG 2.1.2 / 2.4.3).
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Give focus back to whatever opened the dialog.
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-10 text-center">
            <motion.div
              {...motionProps({
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 },
              })}
              onClick={onClose}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              aria-hidden="true"
            />

            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              {...motionProps({
                initial: { scale: 0.96, opacity: 0, y: 12 },
                animate: { scale: 1, opacity: 1, y: 0 },
                exit: { scale: 0.96, opacity: 0, y: 12 },
              })}
              className={`relative inline-block bg-white border border-slate-200 text-left rounded-lg shadow-2xl ${maxWidth} w-full overflow-hidden`}
            >
              <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between bg-slate-50">
                <h3
                  id={titleId}
                  className="text-sm font-semibold text-slate-900 flex items-center gap-2"
                >
                  <ShieldCheck
                    className="w-4 h-4 text-emerald-600"
                    aria-hidden="true"
                  />
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  aria-label={t("common.cancel")}
                  className="rounded-lg p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5">{children}</div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
