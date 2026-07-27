// International transfers (Chapter V) — destination country, mechanism and
// TIA documentation per transfer. A non-adequacy transfer without a TIA is
// flagged (Schrems II / EDPB Recommendations 01/2020).
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/States';
import { FormField, Input, Select } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchTransfers, createTransfer, updateTransfer } from '../../store/slices/transfersSlice';
import { fetchVendors } from '../../store/slices/vendorsSlice';
import { useT } from '../../i18n';
import { can, ACTIONS } from '../../lib/permissions';
import { TRANSFER_MECHANISMS, ADEQUACY_COUNTRIES, labelOf } from '../../lib/gdpr';

// vendorId '' means "no linked processor — type the recipient by hand".
const EMPTY_FORM = { vendorId: '', recipient: '', destinationCountry: '', mechanism: 'scc', adequacyNote: '', tiaDocumented: false, tiaRef: '' };

export default function TransfersPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('transfers', fetchTransfers);
  // Processors, so a transfer can be linked to one instead of typing the recipient.
  const { items: vendors } = useSliceData('vendors', fetchVendors);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const canManage = can(user, ACTIONS.MANAGE_TRANSFERS);

  // True when a processor is linked: the recipient is taken from the vendor's name,
  // so the free-text recipient box is filled automatically and locked.
  const vendorLinked = Boolean(form.vendorId);

  const closeDialog = () => { setOpen(false); setForm(EMPTY_FORM); };

  // Picking a processor fills (and locks) the recipient from its name; picking
  // "None" clears it so the user types a recipient by hand.
  const onVendorChange = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId);
    setForm((f) => ({ ...f, vendorId, recipient: v ? v.name : '' }));
  };

  const submit = async () => {
    // Send vendorId only when a processor is linked (never an empty string). The
    // recipient always has a value: the vendor's name, or what the user typed.
    const action = await dispatch(createTransfer({ ...form, vendorId: form.vendorId || null }));
    if (action.error) toast.error(t('common.notAuthorized'));
    else { toast.success(t('common.save')); closeDialog(); }
  };

  const toggleTia = async (tr) => {
    const action = await dispatch(updateTransfer({
      id: tr.id,
      patch: { tiaDocumented: !tr.tiaDocumented },
    }));
    if (action.error) toast.error(t('common.notAuthorized'));
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('transfers.title')} subtitle={t('transfers.subtitle')}>
        {canManage && <Button onClick={() => setOpen(true)}><Plus /> {t('transfers.add')}</Button>}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === 'pl' ? 'Odbiorca' : 'Recipient'}</TableHead>
                <TableHead>{t('transfers.destination')}</TableHead>
                <TableHead>{t('transfers.mechanism')}</TableHead>
                <TableHead>{t('transfers.tia')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((tr) => {
                const needsTia = tr.mechanism !== 'adequacy';
                return (
                  <TableRow key={tr.id}>
                    <TableCell className="font-medium text-foreground">
                      {tr.recipient}
                      {tr.adequacyNote && <p className="text-xs font-normal text-muted-foreground">{tr.adequacyNote}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tr.destinationCountry}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {labelOf(TRANSFER_MECHANISMS, tr.mechanism, lang)}
                    </TableCell>
                    <TableCell>
                      {!needsTia ? (
                        <span className="text-xs text-muted-foreground">n/a (Art. 45)</span>
                      ) : (
                        <button type="button" disabled={!canManage} onClick={() => toggleTia(tr)}
                          className="disabled:cursor-not-allowed" aria-label={t('transfers.tia')}>
                          <Badge variant="outline" className={
                            tr.tiaDocumented
                              ? 'border-(--status-ok)/50 text-(--status-ok)'
                              : 'border-(--status-risk)/50 text-(--status-risk)'
                          }>
                            {tr.tiaDocumented ? t('transfers.tiaDone') : t('transfers.tiaMissing')}
                          </Badge>
                        </button>
                      )}
                      {tr.tiaRef && <p className="mt-0.5 text-xs text-muted-foreground">{tr.tiaRef}</p>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('transfers.add')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {/* Optional processor link: pick one and the recipient is filled from it. */}
            <FormField
              label={lang === 'pl' ? 'Podmiot przetwarzający (opcjonalnie)' : 'Processor (optional)'}
              hint={lang === 'pl'
                ? 'Wybierz podmiot, aby powiązać transfer i pobrać nazwę odbiorcy z jego danych.'
                : 'Pick a processor to link the transfer and take the recipient name from it.'}
            >
              {(fid) => (
                <Select id={fid} value={form.vendorId} onChange={(e) => onVendorChange(e.target.value)}>
                  <option value="">{lang === 'pl' ? '— Brak (wpisz odbiorcę ręcznie) —' : '— None (type recipient) —'}</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField
              label={lang === 'pl' ? 'Odbiorca danych' : 'Data recipient'}
              required={!vendorLinked}
              hint={vendorLinked
                ? (lang === 'pl' ? 'Pobrano z wybranego podmiotu.' : 'Filled from the selected processor.')
                : undefined}
            >
              {(fid) => (
                <Input id={fid} value={form.recipient} disabled={vendorLinked}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
              )}
            </FormField>
            <FormField label={t('transfers.destination')} required
              hint={`${lang === 'pl' ? 'Decyzje adekwatności' : 'Adequacy decisions'}: ${ADEQUACY_COUNTRIES.slice(0, 6).join(', ')}…`}>
              {(fid) => <Input id={fid} value={form.destinationCountry} onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })} />}
            </FormField>
            <FormField label={t('transfers.mechanism')}>
              {(fid) => (
                <Select id={fid} value={form.mechanism} onChange={(e) => setForm({ ...form, mechanism: e.target.value })}>
                  {TRANSFER_MECHANISMS.map((m) => (
                    <option key={m.id} value={m.id}>{m[lang]} ({m.ref})</option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label={lang === 'pl' ? 'Notatka' : 'Note'}>
              {(fid) => <Input id={fid} value={form.adequacyNote} onChange={(e) => setForm({ ...form, adequacyNote: e.target.value })} />}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button onClick={submit} disabled={!form.recipient.trim() || !form.destinationCountry.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
