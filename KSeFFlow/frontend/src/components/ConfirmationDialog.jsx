import { useEffect, useRef } from 'react';

/** Accessible confirmation dialog shared by consequential workspace actions. */
export default function ConfirmationDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  loading = false,
  onCancel,
  onConfirm,
}) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && !loading && onCancel()}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-message"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <h2 id="confirmation-dialog-title" className="text-base font-black text-slate-900">
          {title}
        </h2>
        <p id="confirmation-dialog-message" className="mt-2 text-sm leading-relaxed text-slate-600">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
