// Users & roles — invitation, role changes and the permission matrix.
// The matrix shown here is the SAME object that guards routes, buttons and
// service calls (lib/permissions.js) — displayed, and enforced.
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { failureMessage } from '../../lib/apiErrors';

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
  const [errors, setErrors] = useState({});
  const [userToDelete, setUserToDelete] = useState(null);
  const canDeleteUsers = me?.role === 'ROLE_ADMIN';

  const closeDialog = () => { setOpen(false); setForm(EMPTY_FORM); setErrors({}); };

  // Update a field and clear its error as soon as the user starts fixing it.
  const setField = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const submit = async () => {
    // Say what is missing, next to the field. The Save button used to be silently disabled
    // on two conditions, one of which was a bare "does the address contain an @".
    const found = {};
    if (!form.name.trim()) found.name = t('users.nameRequired');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) found.email = t('users.emailRequired');
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    const action = await dispatch(inviteUser(form));
    if (action.error) {
      toast.error(action.error.message === 'EMAIL_EXISTS'
        ? t('common.emailExists')
        : failureMessage(action.error, t));
    } else {
      toast.success(t('common.save'));
      closeDialog();
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
      toast.error(failureMessage(action.error, t));
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
      toast.error(failureMessage(action.error, t));
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
              <TableHead>{t('users.user')}</TableHead>
              <TableHead>{t('users.businessEmail')}</TableHead>
              <TableHead>{t('users.permissions')}</TableHead>
              <TableHead>{t('users.accountRole')}</TableHead>
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
                    {/* The shared Badge, not a hand-rolled pill with its own border,
                        padding and radius — those drifted from every other chip in the app. */}
                    <Badge variant="outline" className={u.hasAccess
                      ? 'border-(--status-ok)/40 text-(--status-ok)'
                      : 'text-muted-foreground'}>
                      {u.hasAccess ? t('users.hasAccess') : t('users.noAccess')}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  {u.privacyPermissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {u.privacyPermissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          {ROLE_LABELS[permission]?.[lang] ?? permission}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('users.noPermissions')}</span>
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
                    title={u.active ? t('users.toggleActive') : t('users.toggleInactive')}
                  >
                    {u.active ? t('users.active') : t('users.disabled')}
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
          {/* The old caption read "enforced on every route, button, and service call — not
              just displayed". "Route" and "service call" mean nothing to an administrator,
              and the reassurance was written for a developer reviewing the code. */}
          <p className="text-xs text-muted-foreground">{t('users.matrixCaption')}</p>
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
                  {/* Every row used to print its internal code — VIEW_REGISTER,
                      MANAGE_DPIA — in a monospace font. */}
                  <TableCell className="text-xs text-muted-foreground">{t(`perm.${a}`)}</TableCell>
                  {roleIds.map((r) => (
                    <TableCell key={r} className="text-center">
                      {permissionCan(r, a)
                        ? <Check className="mx-auto size-3.5 text-(--status-ok)" aria-label={t('users.allowed')} />
                        : <Minus className="mx-auto size-3.5 text-border" aria-label={t('users.denied')} />}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('users.invite')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <FormField label={t('users.fullName')} required error={errors.name}>
              {(fid) => <Input id={fid} value={form.name} onChange={(e) => setField({ name: e.target.value })} />}
            </FormField>
            <FormField label={t('users.businessEmail')} required error={errors.email}>
              {(fid) => <Input id={fid} type="email" value={form.email} onChange={(e) => setField({ email: e.target.value })} />}
            </FormField>
            <div className="grid gap-1.5">
              <p className="text-xs">{t('users.grantsAccessTo')}</p>
              <Badge variant="outline" className="w-fit gap-1.5 border-(--status-ok)/40 bg-(--status-ok)/10 text-(--status-ok)">
                <ShieldCheck className="size-3.5" aria-hidden /> PrivacyPilot
              </Badge>
            </div>
            <div className="grid gap-1.5">
              {/* Called "permissions", not "role": a person can hold several at once, which
                  is why these are checkboxes — and it matches the table column above. */}
              <p className="text-xs">
                {t('users.permissions')}{' '}
                <span className="text-muted-foreground">({t('users.optional')})</span>
              </p>
              <div className="grid gap-2 rounded-lg border p-3">
                {roleIds.map((role) => (
                  <label key={role} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={form.permissions.includes(role)}
                      onChange={(e) => setField({
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
            <FormField label={`${t('users.accountRole')} (${t('users.optional')})`}>
              {(fid) => (
                <Select id={fid} value={form.role} onChange={(e) => setField({ role: e.target.value })}>
                  <option value="ROLE_USER">{ACCOUNT_ROLE_LABELS.ROLE_USER[lang]}</option>
                  <option value="ROLE_ADMIN">{ACCOUNT_ROLE_LABELS.ROLE_ADMIN[lang]}</option>
                </Select>
              )}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            {/* Deliberately NOT disabled — pressing Save explains what is missing. */}
            <Button onClick={submit}>{t('common.save')}</Button>
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
