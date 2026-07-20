import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Loader2, AlertTriangle, CheckCircle2, RefreshCw, ArrowUpCircle,
  Package as PackageIcon, Users, Infinity as InfinityIcon,
} from 'lucide-react';
import { tenantService } from '../../services/tenantService';
import { useAllPackages, useRenewPackage, useUpgradePackage } from '../../hooks/useTenantPackage';

// ── Small formatting helpers ────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtPrice = (price, currency) =>
  (price == null || Number(price) === 0)
    ? 'Free'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'EUR' }).format(price);

const DURATION_SUFFIX = { MONTHLY: '/mo', YEARLY: '/yr', DAYS: '', LIFETIME: ' · one-time' };

// Is the current plan expired (planExpiring in the past)?
const isExpired = (plan) =>
  plan?.expiringDate && new Date(plan.expiringDate).getTime() < Date.now();

export default function TenantPackagePage() {
  const { tenantId, id } = useParams();       // tenantId = company context ("platform"); id = target tenant
  const navigate = useNavigate();
  const location = useLocation();

  // The tenant is normally passed via navigation state from the tenants table.
  // On a hard refresh that state is gone, so fall back to fetching the list and
  // finding the tenant by id (there is no single-tenant GET endpoint).
  const passedTenant = location.state?.tenant ?? null;
  const {
    data: lookupData,
    isLoading: lookupLoading,
    isError: lookupError,
  } = useQuery({
    queryKey: ['tenants', 'lookup', id],
    queryFn: () => tenantService.getAll({ size: 100 }),
    enabled: !passedTenant,
  });
  const tenant = passedTenant ?? lookupData?.content?.find((t) => t.id === id) ?? null;

  // Local mirror of the active plan so the UI updates instantly after a mutation
  // (the tenant object from navigation state is a snapshot).
  const [currentPlan, setCurrentPlan] = useState(passedTenant?.currentPackage ?? null);
  useEffect(() => {
    if (tenant) setCurrentPlan(tenant.currentPackage ?? null);
  }, [tenant]);

  const { data: pkgData, isLoading: pkgLoading, isError: pkgError, error: pkgErr } = useAllPackages();
  const packages = pkgData?.content ?? [];

  // { action: 'renew' | 'upgrade', pkg } — drives the confirmation dialog
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');

  const renew = useRenewPackage(id, {
    onSuccess: (res) => {
      setCurrentPlan((p) => (p ? { ...p, startingDate: res.planStarted, expiringDate: res.planExpiring } : p));
      closeConfirm();
    },
  });
  const upgrade = useUpgradePackage(id, {
    onSuccess: (res) => {
      // Reflect the newly chosen tier locally (matched by the card we acted on).
      if (confirm?.pkg) {
        setCurrentPlan({ ...confirm.pkg, startingDate: res.planStarted, expiringDate: res.planExpiring });
      }
      closeConfirm();
    },
  });

  const busy = renew.isPending || upgrade.isPending;

  function openConfirm(action, pkg) {
    setReason('');
    setConfirm({ action, pkg });
  }
  function closeConfirm() {
    setConfirm(null);
    setReason('');
  }
  function submitConfirm() {
    if (!confirm) return;
    const body = reason.trim() ? { reason: reason.trim() } : {};
    if (confirm.action === 'renew') {
      renew.mutate(body);
    } else {
      upgrade.mutate({ packageId: confirm.pkg.id, ...body });
    }
  }

  const backToList = () => navigate(`/company/${tenantId}/tenants`);

  // ── Edge: tenant could not be resolved ──────────────────────────────────────
  if (!tenant) {
    if (lookupLoading) {
      return (
        <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Loading tenant…</span>
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
        <p className="text-sm font-semibold text-slate-600">
          {lookupError ? 'Failed to load this tenant.' : 'Tenant not found.'}
        </p>
        <Button variant="outline" onClick={backToList} className="border-slate-200">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to tenants
        </Button>
      </div>
    );
  }

  const currentId = currentPlan?.id ?? null;
  const lifetime = currentPlan?.durationType === 'LIFETIME';
  const currentInactive = currentPlan && currentPlan.status && currentPlan.status !== 'ACTIVE';
  const expired = isExpired(currentPlan);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="space-y-3">
        <button
          onClick={backToList}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to tenants
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Manage Plan</h2>
          <p className="text-sm text-slate-500 font-medium">
            {tenant.name} — renew the current plan or switch to another tier.
          </p>
        </div>
      </div>

      {/* ── Current plan summary ── */}
      {currentPlan ? (
        <Card className="border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Current plan</p>
              <p className="text-lg font-bold text-slate-800">{currentPlan.name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Valid until</p>
              <p className="text-sm font-semibold text-slate-700">
                {lifetime ? 'Lifetime (no expiry)' : fmtDate(currentPlan.expiringDate)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Price</p>
              <p className="text-sm font-semibold text-slate-700">
                {fmtPrice(currentPlan.price, currentPlan.currency)}
                <span className="text-slate-400">{DURATION_SUFFIX[currentPlan.durationType] ?? ''}</span>
              </p>
            </div>
            {expired && !lifetime && (
              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-600 text-[10px] font-bold">
                Expired
              </Badge>
            )}
            {currentInactive && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold">
                Plan retired from catalogue
              </Badge>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50/60 shadow-sm rounded-xl">
          <CardContent className="p-4 flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-semibold">
              This tenant has no active plan. Choose a plan below to assign one.
            </span>
          </CardContent>
        </Card>
      )}

      {/* ── Package catalogue ── */}
      {pkgLoading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Loading plans…</span>
        </div>
      ) : pkgError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-rose-500">
          <AlertTriangle className="h-6 w-6" />
          <span className="text-sm font-semibold">{pkgErr?.message ?? 'Failed to load plans'}</span>
        </div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-400">
          <PackageIcon className="h-8 w-8" />
          <span className="text-sm font-medium">No packages in the catalogue yet</span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => {
            const isCurrent = pkg.id === currentId;
            const targetInactive = pkg.status && pkg.status !== 'ACTIVE';
            // Renew is only possible on an ACTIVE, non-lifetime current plan.
            const renewDisabled = busy || lifetime || currentInactive;
            const upgradeDisabled = busy || targetInactive;

            return (
              <Card
                key={pkg.id}
                className={`rounded-xl border shadow-sm transition-colors ${
                  isCurrent ? 'border-red-300 ring-1 ring-red-200 bg-red-50/30' : 'border-slate-200 bg-white'
                }`}
              >
                <CardContent className="p-5 space-y-4">
                  {isCurrent && (
                    <Badge className="bg-red-600 text-white text-[10px] font-bold shadow-sm">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Your current plan
                    </Badge>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800">{pkg.name}</p>
                      {pkg.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{pkg.description}</p>
                      )}
                    </div>
                    {targetInactive && !isCurrent && (
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-400 text-[9px] font-bold">
                        {pkg.status}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-slate-900">{fmtPrice(pkg.price, pkg.currency)}</span>
                    <span className="text-xs text-slate-400 font-medium">{DURATION_SUFFIX[pkg.durationType] ?? ''}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      {pkg.durationType === 'LIFETIME'
                        ? <><InfinityIcon className="h-3 w-3" /> Lifetime</>
                        : <>{pkg.duration ?? '—'} days</>}
                    </span>
                    {pkg.appIds?.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <PackageIcon className="h-3 w-3" /> {pkg.appIds.length} module{pkg.appIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Action */}
                  {isCurrent ? (
                    <div className="space-y-1">
                      <Button
                        disabled={renewDisabled}
                        onClick={() => openConfirm('renew', pkg)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Renew plan
                      </Button>
                      {lifetime && (
                        <p className="text-[10px] text-slate-400 text-center">Lifetime plan — no renewal needed</p>
                      )}
                      {currentInactive && (
                        <p className="text-[10px] text-amber-600 text-center">Plan retired — switch to an active tier</p>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={upgradeDisabled}
                      onClick={() => openConfirm('upgrade', pkg)}
                      className="w-full border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs disabled:opacity-50"
                    >
                      <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" />
                      {targetInactive ? 'Unavailable' : (currentPlan ? 'Upgrade to this plan' : 'Assign this plan')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Confirmation dialog ── */}
      <Dialog open={!!confirm} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold flex items-center gap-2">
              {confirm?.action === 'renew'
                ? <><RefreshCw className="h-4 w-4 text-red-600" /> Renew plan</>
                : <><ArrowUpCircle className="h-4 w-4 text-red-600" /> Change plan</>}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {confirm?.action === 'renew' ? (
                <>Renew <strong>{tenant.name}</strong>’s <strong>{confirm?.pkg?.name}</strong> plan for another
                  billing period. This generates a new invoice.</>
              ) : (
                <>Switch <strong>{tenant.name}</strong> from <strong>{currentPlan?.name ?? 'no plan'}</strong> to{' '}
                  <strong>{confirm?.pkg?.name}</strong>. The new plan starts today and a new invoice is generated.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Reason (optional)
            </Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder={confirm?.action === 'renew' ? 'e.g. Annual renewal' : 'e.g. Volume growth'}
              className="h-9 text-sm border-slate-200"
            />
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button variant="outline" className="border-slate-200 text-slate-600" onClick={closeConfirm} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={submitConfirm}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {busy
                ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Working…</>
                : confirm?.action === 'renew' ? 'Confirm renewal' : 'Confirm change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
