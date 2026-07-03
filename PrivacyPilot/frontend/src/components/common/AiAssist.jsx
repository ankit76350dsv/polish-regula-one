// Shared AI-assist UI: transparency badge, disclaimer, enable-check hook,
// and the generic "AI draft" dialog used by breach/DSAR letters.
// EU AI Act Art. 50: users must know they interact with AI and AI output
// must be recognisable — hence the badge on every AI surface.
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Sparkles, Copy, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from './Field';
import { fetchSettings } from '../../store/slices/settingsSlice';
import { useT } from '../../i18n';

/** Is the AI assistant enabled for this tenant? (fetches settings if needed) */
export function useAiEnabled() {
  const dispatch = useDispatch();
  const { data, status } = useSelector((s) => s.settings);
  useEffect(() => {
    if (status === 'idle') dispatch(fetchSettings());
  }, [status, dispatch]);
  return data?.ai?.enabled ?? false;
}

export function AiBadge() {
  const { t } = useT();
  return (
    <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
      <Sparkles className="size-3" aria-hidden /> {t('ai.badge')}
    </Badge>
  );
}

export function AiDisclaimer() {
  const { t } = useT();
  return <p className="text-[11px] text-muted-foreground">{t('ai.disclaimer')}</p>;
}

/**
 * Generic AI-draft dialog: opens, generates via `generate()` (a thunk-dispatching
 * async fn returning text), shows the editable draft with copy/download.
 * The human edits and takes the text out — the dialog never writes to records.
 */
export function AiDraftDialog({ open, onOpenChange, title, generate, filename }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText('');
    setLoading(true);
    generate()
      .then((draft) => setText(draft ?? ''))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('ai.copied'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{title} <AiBadge /></DialogTitle>
          <DialogDescription>{t('ai.disclaimer')}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('ai.generating')}</p>
        ) : (
          <>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-72 font-mono text-xs" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copy}><Copy /> {t('ai.copy')}</Button>
              <Button variant="outline" size="sm" onClick={download}><Download /> {t('notices.download')}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
