// "This document is a draft — have it reviewed before you publish it."
//
// WHY IT IS A COMPONENT AND NOT A PERMANENT BANNER: this used to sit in the app shell, so
// it appeared on EVERY screen — including the dashboard, which produces no documents at all.
// A warning shown where it does not apply is worse than no warning: people stop reading it,
// and it is then missed on the two screens where it genuinely matters.
//
// So it now appears only where a document is actually produced for use outside the app:
//   • Privacy notices (Art. 13/14) — the text given to employees, candidates, customers
//   • Breach report (Art. 33(3))   — the notification submitted to UODO
import { useT } from '../../i18n';

export default function DraftsDisclaimer({ className = '' }) {
  const { t } = useT();
  return (
    <p
      role="note"
      className={`rounded-md border border-primary/20 bg-accent px-3 py-2 text-[11px] leading-relaxed text-accent-foreground ${className}`}
    >
      {t('app.disclaimer')}
    </p>
  );
}
