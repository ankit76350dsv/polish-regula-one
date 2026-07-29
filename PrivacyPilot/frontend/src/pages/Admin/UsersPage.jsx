// Users & roles — invitation, role changes and the permission matrix.
// The matrix shown here is the SAME object that guards routes, buttons and
// service calls (lib/permissions.js) — displayed, and enforced.
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Plus, Check, Minus, ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PageHeader from '../../components/common/PageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { LoadingState, ErrorState } from '../../components/common/States';
import { FormField, Input, Select } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import {
  deleteUser,
  fetchUsers,
  inviteUser,
  setUserActive,
} from '../../store/slices/usersSlice';
import { useT } from '../../i18n';
import { ROLES, ROLE_LABELS, ACTIONS, permissionCan } from '../../lib/permissions';

const EMPTY_FORM = { name: '', email: '', permissions: [], role: 'ROLE_USER' };
const ACCOUNT_ROLE_LABELS = {
  ROLE_USER: { en: 'User', pl: 'Użytkownik' },
  ROLE_ADMIN: { en: 'Admin', pl: 'Administrator' },
  ROLE_SUPER_ADMIN: { en: 'Super Admin', pl: 'Superadministrator' },
};

export default function UsersPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const me = useSelector((s) => s.auth.user);
  const saveStatus = useSelector((s) => s.users.saveStatus);
  const deleteStatus = useSelector((s) => s.users.deleteStatus);
  const { items, status, error, refetch } = useSliceData('users', fetchUsers);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [userToDelete, setUserToDelete] = useState(null);
  const canDeleteUsers = me?.role === 'ROLE_ADMIN';

  const submit = async () => {
    const action = await dispatch(inviteUser(form));
    if (action.error) {
      toast.error(action.error.message === 'EMAIL_EXISTS' ? t('common.emailExists') : t('common.notAuthorized'));
    } else {
      toast.success(t('common.save'));
      setOpen(false);
      setForm(EMPTY_FORM);
    }
  };

  const toggleActive = async (u) => {
    if (u.id === me.id) return;
    const action = await dispatch(setUserActive({ id: u.id, active: !u.active }));
    if (!action.error) {
      toast.success(t('users.statusUpdated'));
    } else if (action.error.message === 'INVALID_STATE') {
      toast.error(t('users.statusProtected'));
    } else {
      toast.error(t('common.notAuthorized'));
    }
  };

  const remove = async () => {
    if (!userToDelete || userToDelete.id === me.id) return;
    const action = await dispatch(deleteUser(userToDelete.id));
    if (!action.error) {
      toast.success(t('users.deleteSuccess'));
      return;
    }

    if (action.error.message === 'INVALID_STATE') {
      toast.error(t('users.deleteProtected'));
    } else if (action.error.message === 'RESOURCE_NOT_FOUND') {
      toast.error(t('users.deleteNotFound'));
    } else {
      toast.error(t('common.notAuthorized'));
    }
  };

  if (status === 'loading' || status === 'idle') return <LoadingState rows={4} />;
  if (status === 'failed') return <ErrorState error={error} onRetry={refetch} />;

  const roleIds = Object.keys(ROLES);
  const actionIds = Object.keys(ACTIONS);

  return (
    <div>
      <PageHeader title={t('users.title')}>
        <Button onClick={() => setOpen(true)}><Plus /> {t('users.invite')}</Button>
      </PageHeader>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === 'pl' ? 'Użytkownik' : 'User'}</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>{lang === 'pl' ? 'Uprawnienia PrivacyPilot' : 'PrivacyPilot permissions'}</TableHead>
              <TableHead>{lang === 'pl' ? 'Rola konta' : 'Account role'}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead className="w-20 text-right">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((u) => (
              <TableRow key={u.id} className={!u.active || !u.hasAccess ? 'opacity-50' : ''}>
                <TableCell className="font-medium text-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{u.name} {u.id === me.id && <span className="text-xs text-primary">({t('common.you')})</span>}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      u.hasAccess
                        ? 'border-(--status-ok)/40 text-(--status-ok)'
                        : 'border-border text-muted-foreground'
                    }`}>
                      {u.hasAccess
                        ? (lang === 'pl' ? 'Dostęp' : 'Access')
                        : (lang === 'pl' ? 'Brak dostępu' : 'No access')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  {u.privacyPermissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {u.privacyPermissions.map((permission) => (
                        <span key={permission}
                          className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {ROLE_LABELS[permission]?.[lang] ?? permission}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {lang === 'pl' ? 'Brak uprawnień PrivacyPilot' : 'No PrivacyPilot permissions'}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  {ACCOUNT_ROLE_LABELS[u.accountRole]?.[lang] ?? u.accountRole ?? '—'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={u.id === me.id || me?.role !== 'ROLE_ADMIN' || saveStatus === 'saving'}
                    onClick={() => toggleActive(u)}
                  >
                    {u.active
                      ? (lang === 'pl' ? 'Aktywny' : 'Active')
                      : (lang === 'pl' ? 'Wyłączony' : 'Disabled')}
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  {canDeleteUsers && u.id !== me.id ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={deleteStatus === 'loading'}
                      aria-label={t('common.delete')}
                      onClick={() => setUserToDelete(u)}
                    >
                      <Trash2 />
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('users.matrix')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('users.matrixHint')}</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{t('common.action')}</TableHead>
                {roleIds.map((r) => (
                  <TableHead key={r} className="text-center text-xs">{ROLE_LABELS[r][lang]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {actionIds.map((a) => (
                <TableRow key={a}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{a}</TableCell>
                  {roleIds.map((r) => (
                    <TableCell key={r} className="text-center">
                      {permissionCan(r, a)
                        ? <Check className="mx-auto size-3.5 text-(--status-ok)" aria-label="allowed" />
                        : <Minus className="mx-auto size-3.5 text-border" aria-label="denied" />}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('users.invite')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <FormField label={lang === 'pl' ? 'Imię i nazwisko' : 'Full name'} required>
              {(fid) => <Input id={fid} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </FormField>
            <FormField label={lang === 'pl' ? 'E-mail służbowy' : 'Business email'} required>
              {(fid) => <Input id={fid} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
            </FormField>
            <div className="grid gap-1.5">
              <p className="text-xs">{lang === 'pl' ? 'Dostęp' : 'Access'}</p>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-(--status-ok)/40 bg-(--status-ok)/10 px-2.5 py-1 text-xs font-medium text-(--status-ok)">
                <ShieldCheck className="size-3.5" aria-hidden /> PrivacyPilot
              </span>
            </div>
            <div className="grid gap-1.5">
              <p className="text-xs">
                {lang === 'pl' ? 'Rola PrivacyPilot' : 'PrivacyPilot role'}{' '}
                <span className="text-muted-foreground">
                  ({lang === 'pl' ? 'Opcjonalnie' : 'Optional'})
                </span>
              </p>
              <div className="grid gap-2 rounded-lg border p-3">
                {roleIds.map((role) => (
                  <label key={role} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={form.permissions.includes(role)}
                      onChange={(e) => setForm({
                        ...form,
                        permissions: e.target.checked
                          ? [...form.permissions, role]
                          : form.permissions.filter((permission) => permission !== role),
                      })}
                    />
                    <span>{ROLE_LABELS[role][lang]}</span>
                  </label>
                ))}
              </div>
            </div>
            <FormField label={`${lang === 'pl' ? 'Rola konta' : 'Account role'} (${lang === 'pl' ? 'Opcjonalnie' : 'Optional'})`}>
              {(fid) => (
                <Select id={fid} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="ROLE_USER">{lang === 'pl' ? 'Użytkownik' : 'User'}</option>
                  <option value="ROLE_ADMIN">{lang === 'pl' ? 'Administrator' : 'Admin'}</option>
                </Select>
              )}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={submit} disabled={!form.name.trim() || !form.email.includes('@')}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(userToDelete)}
        onOpenChange={(nextOpen) => !nextOpen && setUserToDelete(null)}
        title={userToDelete ? `${t('users.deleteTitle')} ${userToDelete.name}?` : t('users.deleteTitle')}
        description={t('users.deleteDescription')}
        confirmLabel={t('common.delete')}
        onConfirm={remove}
      />
    </div>
  );
}
