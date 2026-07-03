// Users & roles — invitation, role changes and the permission matrix.
// The matrix shown here is the SAME object that guards routes, buttons and
// service calls (lib/permissions.js) — displayed, and enforced.
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Plus, Check, Minus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PageHeader from '../../components/common/PageHeader';
import { LoadingState, ErrorState } from '../../components/common/States';
import { FormField, Input, Select } from '../../components/common/Field';
import { useSliceData } from '../../hooks/useSliceData';
import { fetchUsers, inviteUser, changeUserRole, setUserActive } from '../../store/slices/usersSlice';
import { useT } from '../../i18n';
import { ROLES, ROLE_LABELS, ACTIONS, can } from '../../lib/permissions';

const EMPTY_FORM = { name: '', email: '', role: 'EMPLOYEE' };

export default function UsersPage() {
  const { t, lang } = useT();
  const dispatch = useDispatch();
  const me = useSelector((s) => s.auth.user);
  const { items, status, error, refetch } = useSliceData('users', fetchUsers);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const submit = async () => {
    const action = await dispatch(inviteUser(form));
    if (action.error) {
      toast.error(action.error.message === 'EMAIL_EXISTS' ? 'E-mail exists' : t('common.notAuthorized'));
    } else {
      toast.success(t('common.save'));
      setOpen(false);
      setForm(EMPTY_FORM);
    }
  };

  const setRole = async (id, role) => {
    if (id === me.id) { toast.error(lang === 'pl' ? 'Nie możesz zmienić własnej roli.' : 'You cannot change your own role.'); return; }
    const action = await dispatch(changeUserRole({ id, role }));
    if (action.error) toast.error(t('common.notAuthorized'));
  };

  const toggleActive = async (u) => {
    if (u.id === me.id) return;
    const action = await dispatch(setUserActive({ id: u.id, active: !u.active }));
    if (action.error) toast.error(t('common.notAuthorized'));
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
              <TableHead>{t('users.role')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((u) => (
              <TableRow key={u.id} className={!u.active ? 'opacity-50' : ''}>
                <TableCell className="font-medium text-foreground">
                  {u.name} {u.id === me.id && <span className="text-xs text-primary">(you)</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Select value={u.role} disabled={u.id === me.id}
                    onChange={(e) => setRole(u.id, e.target.value)}
                    aria-label={t('users.role')} className="w-56 text-xs">
                    {roleIds.map((r) => <option key={r} value={r}>{ROLE_LABELS[r][lang]}</option>)}
                  </Select>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="xs" disabled={u.id === me.id} onClick={() => toggleActive(u)}>
                    {u.active ? (lang === 'pl' ? 'Aktywny' : 'Active') : (lang === 'pl' ? 'Wyłączony' : 'Disabled')}
                  </Button>
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
                <TableHead className="text-xs">Action</TableHead>
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
                      {can(r, a)
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
            <FormField label="E-mail" required>
              {(fid) => <Input id={fid} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
            </FormField>
            <FormField label={t('users.role')}>
              {(fid) => (
                <Select id={fid} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {roleIds.map((r) => <option key={r} value={r}>{ROLE_LABELS[r][lang]}</option>)}
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
    </div>
  );
}
