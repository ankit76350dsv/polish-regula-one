// The export control used by every screen that lets data leave PrivacyPilot.
//
// WHY IT IS ONE COMPONENT: taking a copy of personal data out of the app has a rule attached
// to it — the export must be RECORDED in the audit trail first, and the file handed over only
// if that recording succeeded ("no evidence, no copy", GDPR Art. 5(2) accountability). That
// rule was being re-implemented by hand on each screen that grew an export button. Every new
// copy of it is a chance to get the order wrong, forget the permission check, or swallow the
// failure and hand the file over anyway — which would leave the register walking out of the
// door with nothing in the trail to show it.
//
// So the sequence lives here, once:
//
//   1. is this person even allowed to export?  (no button at all if not)
//   2. build the document                       (in memory — nothing has left yet)
//   3. record the export on the server          (the immutable EXPORT audit line)
//   4. only now hand the file to the user
//
// Step 3 failing means step 4 does not happen, and the user is told why.
//
// The permission check mirrors the server: the same roles that hold EXPORT_DATA here are the
// only ones the /exports endpoint accepts, so a button never promises something the API will
// refuse. The frontend check is for the user's benefit — the server's is the one that counts.
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Copy, Download, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { recordExport } from '../../store/slices/exportsSlice';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { downloadCsv } from '../../lib/csv';
import { downloadMarkdown, downloadWord, printDocument } from '../../lib/documentDownload';

// Which icon and wording each format gets. Kept in one place so "Word" is offered the same
// way on the notices screen, the DPIA screen and the request screen.
const FORMAT_META = {
  csv: { icon: Download, key: 'export.csv' },
  markdown: { icon: Download, key: 'export.markdown' },
  word: { icon: Download, key: 'export.word' },
  print: { icon: Printer, key: 'export.print' },
  clipboard: { icon: Copy, key: 'export.copy' },
};

/**
 * @param {object} p
 * @param {string} p.target        which register/document is leaving — one of the codes the
 *                                 server's ExportTarget knows (e.g. 'register_breaches')
 * @param {string[]} [p.formats]   the formats to offer, in order. Defaults to CSV only.
 * @param {string} [p.entityId]    required for single-document targets (one DPIA, one notice)
 * @param {number} [p.itemCount]   how many records the copy holds, for the audit line
 * @param {string} [p.filterSummary] the filters that were on screen, for the audit line
 * @param {string} [p.documentTitle] the title used inside a Word file / print view
 * @param {(format: string) => (object|Promise<object>)} p.build
 *        produces the artifact: { filename, content } and may also return itemCount /
 *        filterSummary when only the builder knows them (e.g. after fetching the rows).
 *        Return null/undefined to abort quietly — nothing is recorded and nothing is sent.
 * @param {boolean} [p.disabled]
 * @param {string} [p.label]       overrides the wording of a single-format button
 * @param {string} [p.size]        button size, defaults to the app's standard
 * @param {string} [p.variant]     button variant, defaults to 'outline'
 */
export default function ExportMenu({
  target,
  formats = ['csv'],
  entityId,
  itemCount,
  filterSummary,
  documentTitle,
  build,
  disabled = false,
  label,
  size,
  variant = 'outline',
}) {
  const { t } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  // Which format is currently running, so only that button shows as busy.
  const [busy, setBusy] = useState(null);

  // No permission, no button. An Employee cannot read this data at all, so they must never
  // be shown a control that claims they could take a copy of it.
  if (!can(user, ACTIONS.EXPORT_DATA)) return null;

  /** Hand the finished artifact to the user, in the shape the chosen format needs. */
  const deliver = async (format, artifact) => {
    const { filename, content } = artifact;
    const title = documentTitle ?? filename;
    if (format === 'csv') return downloadCsv(filename, content);
    if (format === 'markdown') return downloadMarkdown(filename, content);
    if (format === 'word') return downloadWord(filename, title, content);
    if (format === 'print') return printDocument(title, content);
    if (format === 'clipboard') {
      await navigator.clipboard.writeText(content);
      toast.success(t('ai.copied'));
    }
    return undefined;
  };

  const run = async (format) => {
    setBusy(format);
    try {
      // Step 2 — build it. Purely in memory (or a read of the rows to include); the data has
      // not left the app yet, so a failure here costs nothing but a message.
      let artifact;
      try {
        artifact = await build(format);
      } catch {
        toast.error(t('common.error'));
        return;
      }
      // The builder decided there is nothing to export (no settings loaded, no rows).
      if (!artifact?.content) return;

      // Step 3 — record it. This is the gate: everything below depends on it succeeding.
      const action = await dispatch(recordExport({
        target,
        format,
        entityId,
        itemCount: artifact.itemCount ?? itemCount,
        filterSummary: artifact.filterSummary ?? filterSummary,
      }));
      if (action.error) {
        toast.error(action.error.message === 'FORBIDDEN'
          ? t('common.notAuthorized')
          : t('export.failed'));
        return;
      }

      // Step 4 — and only now does the file exist outside the app.
      try {
        await deliver(format, artifact);
      } catch {
        // The copy IS recorded but the browser refused to complete it (a blocked pop-up for
        // the print view, or a denied clipboard). Say so rather than failing silently: the
        // audit line already exists, and the user needs to know the file did not arrive.
        toast.error(t('export.deliveryFailed'));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {formats.map((format) => {
        const meta = FORMAT_META[format];
        if (!meta) return null;
        const Icon = meta.icon;
        // A single-format control can be given its own wording ("Export register (CSV)");
        // when several are offered, each says only which format it is.
        const text = formats.length === 1 && label ? label : t(meta.key);
        return (
          <Button
            key={format}
            variant={variant}
            size={size}
            onClick={() => run(format)}
            disabled={disabled || busy !== null}
          >
            <Icon /> {busy === format ? t('export.working') : text}
          </Button>
        );
      })}
    </>
  );
}
