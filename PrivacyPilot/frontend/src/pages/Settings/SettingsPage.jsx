// Settings — company identity (feeds the register export and every notice)
// and the DPO section with the Polish UODO tracker: designation must be
// notified to UODO within 14 days, electronically only (Art. 10, Act of
// 10 May 2018), and the DPO contact published on the website (Art. 11).
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, ErrorState } from '../../components/common/States';
import { FormField, Input } from '../../components/common/Field';
import { fetchSettings, updateSettings } from '../../store/slices/settingsSlice';
import { uodoWindow } from '../../services/settingsService';
import { useT } from '../../i18n';

export default function SettingsPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const { data, status, saveStatus, error } = useSelector((s) => s.settings);
  const [company, setCompany] = useState(null);
  const [dpo, setDpo] = useState(null);
  const [ai, setAi] = useState(null);

  useEffect(() => {
    if (status === 'idle') dispatch(fetchSettings());
  }, [status, dispatch]);

  useEffect(() => {
    if (data) {
      setCompany(data.company);
      setDpo(data.dpo);
      setAi(data.ai ?? { enabled: true, excludeSpecialCategories: true });
    }
  }, [data]);

  if (status === 'loading' || status === 'idle' || !company || !dpo || !ai) return <LoadingState rows={5} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={() => dispatch(fetchSettings())} />;

  const windowDays = uodoWindow(dpo);

  const save = async () => {
    // Only the DPO + AI settings are saved here. The company identity is owned by
    // RegulaOne (read-only in this page), so it is deliberately not sent.
    const action = await dispatch(updateSettings({ dpo, ai }));
    if (action.error) toast.error(t('common.notAuthorized'));
    else toast.success(t('common.save'));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('settings.title')}>
        <Button onClick={save} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? t('common.loading') : t('common.save')}
        </Button>
      </PageHeader>

      <div className="grid gap-4">
        {/* Company identity is owned by RegulaOne (the shared tenant) and shown here
            READ-ONLY. It still feeds the register header (Art. 30(1)(a)) and every
            notice, but is edited on RegulaOne's company profile page, not here. */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('settings.company')}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
              {lang === 'pl'
                ? 'Dane firmy są zarządzane centralnie w RegulaOne (profil firmy) i tutaj są tylko do odczytu. Zasilają nagłówek rejestru (art. 30(1)(a)) i każdą klauzulę informacyjną.'
                : 'Company details are managed centrally in RegulaOne (company profile) and are read-only here. They feed the register header (Art. 30(1)(a)) and every privacy notice.'}
            </p>
            <ReadOnlyRow label={t('settings.companyName')} value={company.name} />
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyRow label={t('settings.nip')} value={company.nip} />
              <ReadOnlyRow label={t('settings.regon')} value={company.regon} />
            </div>
            <ReadOnlyRow label={t('settings.address')} value={company.address} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('settings.dpo')}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t('settings.dpoName')}>
                {(fid) => <Input id={fid} value={dpo.name} onChange={(e) => setDpo({ ...dpo, name: e.target.value })} />}
              </FormField>
              <FormField label={t('settings.dpoEmail')} required>
                {(fid) => <Input id={fid} type="email" value={dpo.email} onChange={(e) => setDpo({ ...dpo, email: e.target.value })} />}
              </FormField>
              <FormField label={t('settings.dpoPhone')}>
                {(fid) => <Input id={fid} value={dpo.phone} onChange={(e) => setDpo({ ...dpo, phone: e.target.value })} />}
              </FormField>
              <FormField label={t('settings.dpoAppointed')}>
                {(fid) => <Input id={fid} type="date" value={dpo.appointedAt?.slice(0, 10) ?? ''}
                  onChange={(e) => setDpo({ ...dpo, appointedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />}
              </FormField>
            </div>

            {/* UODO 14-day notification tracker */}
            <div className={`rounded-lg border p-3 ${
              windowDays == null ? 'border-border'
              : windowDays < 0 ? 'border-(--status-risk)/50 bg-(--status-risk)/5'
              : 'border-(--status-warn)/50 bg-(--status-warn)/5'
            }`}>
              <p className="text-xs font-medium text-foreground">{t('settings.uodoNotification')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('settings.uodoDeadline')}</p>
              {dpo.uodoNotifiedAt ? (
                <p className="mt-2 text-sm text-(--status-ok)">
                  ✓ {t('settings.uodoNotified')} {new Date(dpo.uodoNotifiedAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
                </p>
              ) : windowDays != null && (
                <p className={`mt-2 text-sm ${windowDays < 0 ? 'text-(--status-risk)' : 'text-(--status-warn)'}`}>
                  {windowDays < 0
                    ? t('settings.uodoOverdue')
                    : `${windowDays} ${t('common.daysLeft')}`}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3">
                <FormField label={t('settings.uodoNotified')}>
                  {(fid) => <Input id={fid} type="date" value={dpo.uodoNotifiedAt?.slice(0, 10) ?? ''}
                    onChange={(e) => setDpo({ ...dpo, uodoNotifiedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />}
                </FormField>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#c5a059]" checked={dpo.publishedOnWebsite}
                onChange={(e) => setDpo({ ...dpo, publishedOnWebsite: e.target.checked })} />
              {t('settings.dpoPublished')}
            </label>
          </CardContent>
        </Card>

        {/* AI assistant — per-tenant switch; human-in-the-loop is not optional. */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('ai.settings')}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-[#c5a059]" checked={ai.enabled}
                onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} />
              <span>
                {t('ai.settingsEnabled')}
                <span className="block text-xs text-muted-foreground">{t('ai.settingsEnabledHint')}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-[#c5a059]" checked={ai.excludeSpecialCategories}
                disabled={!ai.enabled}
                onChange={(e) => setAi({ ...ai, excludeSpecialCategories: e.target.checked })} />
              <span className={!ai.enabled ? 'opacity-50' : ''}>{t('ai.settingsExclude')}</span>
            </label>
            <p className="rounded-lg border border-primary/20 bg-accent p-2.5 text-[11px] text-accent-foreground">
              {t('ai.settingsNote')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// A simple label + value line for a read-only field (company identity from RegulaOne).
// Shows a muted "—" when the value has not been filled in on the RegulaOne side yet.
function ReadOnlyRow({ label, value }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value?.trim() ? value : '—'}</span>
    </div>
  );
}
