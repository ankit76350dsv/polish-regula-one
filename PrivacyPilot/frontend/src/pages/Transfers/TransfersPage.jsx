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
import { failureMessage } from '../../lib/apiErrors';

// Does the typed country have an EU adequacy decision? Compared loosely so "japan" and
// "Japan " both match, and partially so "USA (DPF participants only)" matches "USA".
const hasAdequacyDecision = (country) => {
  const typed = country.trim().toLowerCase();
  if (!typed) return false;
  return ADEQUACY_COUNTRIES.some((entry) => {
    const known = entry.toLowerCase();
    return known === typed || known.startsWith(`${typed} (`) || typed === known.split(' (')[0];
  });
};

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
  const [errors, setErrors] = useState({});
  const canManage = can(user, ACTIONS.MANAGE_TRANSFERS);

  // True when a processor is linked: the recipient is taken from the vendor's name,
  // so the free-text recipient box is filled automatically and locked.
  const vendorLinked = Boolean(form.vendorId);
  // Whether the destination the user is typing is covered by an EU adequacy decision.
  const adequacyCountry = hasAdequacyDecision(form.destinationCountry);

  const closeDialog = () => { setOpen(false); setForm(EMPTY_FORM); setErrors({}); };

  // Update one field and clear its error as soon as the user starts fixing it.
  const setField = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  // Picking a processor fills (and locks) the recipient from its name; picking
  // "None" clears it so the user types a recipient by hand.
  const onVendorChange = (vendorId) => {
    const v = vendors.find((x) => x.id === vendorId);
    setForm((f) => ({ ...f, vendorId, recipient: v ? v.name : '' }));
  };

  const submit = async () => {
    // Check first and name the problem next to the field.
    const found = {};
    if (!form.recipient.trim()) found.recipient = t('transfers.recipientRequired');
    if (!form.destinationCountry.trim()) found.destinationCountry = t('transfers.destinationRequired');
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    // Send vendorId only when a processor is linked (never an empty string). The
    // recipient always has a value: the vendor's name, or what the user typed.
    const action = await dispatch(createTransfer({ ...form, vendorId: form.vendorId || null }));
    if (action.error) toast.error(failureMessage(action.error, t));
    else { toast.success(t('common.save')); closeDialog(); }
  };

  const toggleTia = async (tr) => {
    const action = await dispatch(updateTransfer({
      id: tr.id,
      patch: { tiaDocumented: !tr.tiaDocumented },
    }));
    if (action.error) toast.error(failureMessage(action.error, t));
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={t('transfers.title')} subtitle={t('transfers.subtitle')}>
        {canManage && <Button onClick={() => setOpen(true)}><Plus /> {t('transfers.add')}</Button>}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          title={t('transfers.emptyTitle')}
          hint={t('transfers.empty')}
          action={canManage && (
            <Button size="sm" onClick={() => setOpen(true)}><Plus /> {t('transfers.add')}</Button>
          )}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('transfers.recipient')}</TableHead>
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
                        <span className="text-xs text-muted-foreground">{t('transfers.tiaNotRequired')}</span>
                      ) : (
                        // The badge is the control. The label says what CLICKING does, not
                        // just what the column is, and the cursor shows it is clickable.
                        <button type="button" disabled={!canManage} onClick={() => toggleTia(tr)}
                          title={canManage ? t('transfers.toggleTia') : undefined}
                          aria-label={`${t('transfers.tia')} — ${t('transfers.toggleTia')}`}
                          className="cursor-pointer disabled:cursor-default">
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
            <FormField label={t('transfers.processorLink')} hint={t('transfers.processorLinkHint')}>
              {(fid) => (
                <Select id={fid} value={form.vendorId} onChange={(e) => onVendorChange(e.target.value)}>
                  <option value="">{t('transfers.processorNone')}</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField
              label={t('transfers.recipient')}
              required={!vendorLinked}
              error={errors.recipient}
              hint={vendorLinked ? t('transfers.recipientFromProcessor') : undefined}
            >
              {(fid) => (
                <Input id={fid} value={form.recipient} disabled={vendorLinked}
                  onChange={(e) => setField({ recipient: e.target.value })} />
              )}
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* The hint used to list the first six adequacy countries followed by an
                  ellipsis — an arbitrary slice of sixteen that told the user nothing about
                  the one they were typing. It now answers the actual question: does THIS
                  country have an adequacy decision? */}
              <FormField
                label={t('transfers.destination')}
                required
                error={errors.destinationCountry}
                hint={adequacyCountry ? t('transfers.adequacyDetected') : undefined}
              >
                {(fid) => (
                  <Input id={fid} value={form.destinationCountry}
                    onChange={(e) => setField({ destinationCountry: e.target.value })} />
                )}
              </FormField>
              <FormField label={t('transfers.mechanism')}>
                {(fid) => (
                  <Select id={fid} value={form.mechanism} onChange={(e) => setField({ mechanism: e.target.value })}>
                    {TRANSFER_MECHANISMS.map((m) => (
                      <option key={m.id} value={m.id}>{m[lang]} ({m.ref})</option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
            {/* The assessment reference was stored and shown in the table but there was no
                way to enter it — so it could never be filled. Only asked for when the
                chosen mechanism actually requires an assessment. */}
            {form.mechanism !== 'adequacy' && (
              <FormField label={t('transfers.tiaRef')} hint={t('transfers.tiaRefHint')}>
                {(fid) => (
                  <Input id={fid} value={form.tiaRef}
                    onChange={(e) => setField({ tiaRef: e.target.value })} />
                )}
              </FormField>
            )}
            <FormField label={t('transfers.note')} hint={t('transfers.noteHint')}>
              {(fid) => (
                <Input id={fid} value={form.adequacyNote}
                  onChange={(e) => setField({ adequacyNote: e.target.value })} />
              )}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            {/* Deliberately NOT disabled — pressing Save on an incomplete form explains what
                is missing instead of leaving the user with a dead button. */}
            <Button onClick={submit}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
