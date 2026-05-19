// Profile page — shows personal info and (for admin/user) company info.
//
// Edit permissions:
//   Personal info  → any role can edit their own name
//   Company info   → ROLE_ADMIN can edit; ROLE_USER can view but not edit
//   ROLE_SUPER_ADMIN → no company section (platform-level account, no tenant)

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  User, Mail, ShieldCheck, Calendar, Hash, CheckCircle2, XCircle,
  Lock, KeyRound, Pencil, Building2, Phone, MapPin, X, Loader2,
  LayoutGrid,
} from 'lucide-react';
import {
  useMyProfile, useUpdateMyProfile, useMyOrg, useUpdateMyOrg,
} from '../../hooks/useProfile';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const ROLE_STYLE = {
  ROLE_SUPER_ADMIN: 'bg-red-50 text-red-700 border-red-200',
  ROLE_ADMIN:       'bg-blue-50 text-blue-700 border-blue-200',
  ROLE_USER:        'bg-slate-50 text-slate-600 border-slate-200',
};

function displayRole(role = '') {
  return role.replace('ROLE_', '').replace(/_/g, ' ');
}

// Read-only label+value row used in both sections
function InfoRow({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-slate-50 last:border-0">
      <Icon className="h-4 w-4 text-slate-300 flex-shrink-0 mt-0.5" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-32 flex-shrink-0 mt-0.5">
        {label}
      </span>
      <span className={`text-sm font-medium text-slate-700 break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

// Skeleton used during loading
function Skel({ w = 'w-32', h = 'h-4' }) {
  return <div className={`${h} ${w} bg-slate-100 rounded animate-pulse`} />;
}

// Friendly display names and dot colours for each TenantModule enum value.
const MODULE_META = {
  KSEFFLOW:     { label: 'KSeFFlow',    dot: 'bg-blue-400' },
  WORKPULSE:    { label: 'WorkPulse',   dot: 'bg-green-400' },
  SAFEWORK:     { label: 'SafeWork',    dot: 'bg-amber-400' },
  SAFEVOICE:    { label: 'SafeVoice',   dot: 'bg-orange-400' },
  WASTESYNC:    { label: 'WasteSync',   dot: 'bg-red-400' },
  PRIVACYPILOT: { label: 'PrivacyPilot', dot: 'bg-emerald-400' },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: org,     isLoading: orgLoading }     = useMyOrg();
  const updateProfile = useUpdateMyProfile();
  const updateOrg     = useUpdateMyOrg();

  const role      = profile?.role;
  const isAdmin   = role === 'ROLE_ADMIN';
  const isSA      = role === 'ROLE_SUPER_ADMIN';
  const hasOrg    = !isSA && !!profile?.tenantId;

  const initials = profile?.name
    ? profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  // ── Personal edit state ───────────────────────────────────────────────────
  const [editPersonal, setEditPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState({ name: '' });

  useEffect(() => {
    if (profile) setPersonalForm({ name: profile.name ?? '' });
  }, [profile]);

  const handleSavePersonal = () => {
    if (!personalForm.name.trim()) return;
    updateProfile.mutate(
      { name: personalForm.name.trim() },
      { onSuccess: () => setEditPersonal(false) },
    );
  };

  // ── Company edit state (ROLE_ADMIN only) ──────────────────────────────────
  const [editCompany, setEditCompany]   = useState(false);
  const [companyForm, setCompanyForm]   = useState({
    name: '', email: '', phone: '', address: '', city: '', postalCode: '',
  });

  useEffect(() => {
    if (org) {
      setCompanyForm({
        name:       org.name       ?? '',
        email:      org.email      ?? '',
        phone:      org.phone      ?? '',
        address:    org.address    ?? '',
        city:       org.city       ?? '',
        postalCode: org.postalCode ?? '',
      });
    }
  }, [org]);

  const setOrgField = (k, v) => setCompanyForm((f) => ({ ...f, [k]: v }));

  const handleSaveCompany = () => {
    // Only send non-empty strings — the backend treats null as "leave unchanged"
    const payload = Object.fromEntries(
      Object.entries(companyForm).filter(([, v]) => v.trim() !== ''),
    );
    updateOrg.mutate(payload, { onSuccess: () => setEditCompany(false) });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h2>
        <p className="text-sm text-slate-500 font-medium">
          View and manage your account and organisation details.
        </p>
      </div>

      {/* ── Personal Information ─────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 py-5 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Personal Information
            </CardTitle>
            {!profileLoading && !editPersonal && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs font-bold"
                onClick={() => setEditPersonal(true)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {editPersonal && (
              <button
                onClick={() => { setEditPersonal(false); setPersonalForm({ name: profile?.name ?? '' }); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {profileLoading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-slate-100 animate-pulse" />
                <div className="space-y-2">
                  <Skel w="w-40" h="h-5" />
                  <Skel w="w-24" h="h-4" />
                </div>
              </div>
              {[...Array(4)].map((_, i) => <Skel key={i} w="w-full" h="h-10" />)}
            </div>
          ) : (
            <div className="space-y-5">

              {/* Avatar banner */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-red-600 flex items-center justify-center text-xl font-black text-white flex-shrink-0 shadow-md shadow-red-200">
                  {initials}
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900">{profile?.name}</p>
                  <Badge
                    variant="outline"
                    className={`mt-1 text-[10px] font-black uppercase tracking-widest ${ROLE_STYLE[role] ?? ROLE_STYLE.ROLE_USER}`}
                  >
                    {displayRole(role)}
                  </Badge>
                </div>
              </div>

              {/* Inline edit form */}
              {editPersonal ? (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Full Name
                    </Label>
                    <Input
                      value={personalForm.name}
                      onChange={(e) => setPersonalForm({ name: e.target.value })}
                      className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      disabled={updateProfile.isPending}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-slate-200 text-slate-500 font-bold text-xs"
                      onClick={() => { setEditPersonal(false); setPersonalForm({ name: profile?.name ?? '' }); }}
                      disabled={updateProfile.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                      onClick={handleSavePersonal}
                      disabled={updateProfile.isPending || !personalForm.name.trim()}
                    >
                      {updateProfile.isPending
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
                        : 'Save Changes'
                      }
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  <InfoRow icon={Hash}       label="Account ID"    value={profile?.id} mono />
                  <InfoRow icon={Mail}       label="Email"         value={profile?.email} />
                  <InfoRow icon={ShieldCheck} label="Role"         value={displayRole(role)} />
                  <InfoRow icon={User}       label="Status"        value={profile?.enabled ? 'Active' : 'Disabled'} />
                  <InfoRow icon={Calendar}   label="Joined"        value={fmtDate(profile?.createdAt)} />
                  <InfoRow icon={Calendar}   label="Last Updated"  value={fmt(profile?.updatedAt)} />
                </div>
              )}

              {/* Temp password warning */}
              {profile?.tempPassword && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <Lock className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-600 font-medium">
                    Temporary password active.{' '}
                    <Link to="/change-password" className="underline font-bold hover:text-amber-800">
                      Change it now
                    </Link>
                    {' '}before you lose access.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Company Information (admin + user only) ──────────────────────── */}
      {hasOrg && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 py-5 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" /> Company Information
              </CardTitle>

              {/* Only admins get an edit button */}
              {isAdmin && !orgLoading && !editCompany && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs font-bold"
                  onClick={() => setEditCompany(true)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {editCompany && (
                <button
                  onClick={() => { setEditCompany(false); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {orgLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skel key={i} w="w-full" h="h-10" />)}
              </div>
            ) : editCompany ? (
              // ── Edit form (admin only) ──────────────────────────────────
              <div className="space-y-4">
                {[
                  { key: 'name',       label: 'Company Name', icon: Building2 },
                  { key: 'email',      label: 'Company Email', icon: Mail, type: 'email' },
                  { key: 'phone',      label: 'Phone', icon: Phone },
                  { key: 'address',    label: 'Address', icon: MapPin },
                  { key: 'city',       label: 'City', icon: MapPin },
                  { key: 'postalCode', label: 'Postal Code (XX-XXX)', icon: MapPin },
                ].map(({ key, label, icon: Icon, type = 'text' }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Icon className="h-3 w-3 text-slate-400" /> {label}
                    </Label>
                    <Input
                      type={type}
                      value={companyForm[key]}
                      onChange={(e) => setOrgField(key, e.target.value)}
                      className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      disabled={updateOrg.isPending}
                    />
                  </div>
                ))}

                {/* Read-only legal IDs */}
                <div className="pt-2 space-y-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Legal Identifiers (read-only)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">NIP</p>
                      <p className="text-sm font-semibold text-slate-600 font-mono">{org?.nip ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">REGON</p>
                      <p className="text-sm font-semibold text-slate-600 font-mono">{org?.regon ?? '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 border-slate-200 text-slate-500 font-bold text-xs"
                    onClick={() => setEditCompany(false)}
                    disabled={updateOrg.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                    onClick={handleSaveCompany}
                    disabled={updateOrg.isPending}
                  >
                    {updateOrg.isPending
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
                      : 'Save Changes'
                    }
                  </Button>
                </div>
              </div>
            ) : (
              // ── Read-only view (both admin and user) ───────────────────
              <div className="divide-y divide-slate-50">
                <InfoRow icon={Building2} label="Company"     value={org?.name} />
                <InfoRow icon={Hash}      label="NIP"         value={org?.nip} mono />
                <InfoRow icon={Hash}      label="REGON"       value={org?.regon} mono />
                <InfoRow icon={Mail}      label="Email"       value={org?.email} />
                <InfoRow icon={Phone}     label="Phone"       value={org?.phone} />
                <InfoRow icon={MapPin}    label="Address"     value={org?.address} />
                <InfoRow icon={MapPin}    label="City"        value={
                  org?.city && org?.postalCode
                    ? `${org.city}, ${org.postalCode}`
                    : (org?.city ?? org?.postalCode)
                } />
                <InfoRow icon={Calendar}  label="Registered"  value={fmtDate(org?.createdAt)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Module Access (admin + user with a tenant) ───────────────────── */}
      {hasOrg && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 py-5 px-6">
            <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-slate-400" /> Module Access
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {profileLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {[...Array(6)].map((_, i) => <Skel key={i} w="w-full" h="h-8" />)}
              </div>
            ) : (
              <>
                {/* Package ID — small reference for admins / support */}
                {profile?.packageId && (
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24 flex-shrink-0">Plan ID</span>
                    <span className="text-[11px] font-mono text-slate-500 break-all">{profile.packageId}</span>
                  </div>
                )}

                {/* Module badges */}
                {(!profile?.moduleIds || profile.moduleIds.length === 0) ? (
                  <p className="text-sm text-slate-400 font-medium">No modules assigned to your account.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {profile.moduleIds.map((key) => {
                      const meta = MODULE_META[key] ?? { label: key, dot: 'bg-slate-300' };
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50"
                        >
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                          <span className="text-xs font-semibold text-slate-700">{meta.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 py-5 px-6">
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">Security</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <KeyRound className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Password</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Update your account password via Cognito</p>
              </div>
            </div>
            <Link
              to="/change-password"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:border-red-300 hover:text-red-600 transition-colors"
            >
              Change Password
            </Link>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
