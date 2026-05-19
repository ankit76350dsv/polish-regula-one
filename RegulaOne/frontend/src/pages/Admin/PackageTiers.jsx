// License Tiers page — wired to real backend APIs.
// Removes Storage and API Calls fields per product decision (May 2026).
// Replaces mock TIERS and CHANGE_LOG with live data from:
//   GET /api/superadmin/packages/tier-stats  → stats cards + tier cards
//   GET /api/superadmin/tier-changes?limit=4 → recent change log
//   GET /api/superadmin/tier-changes/export  → billing CSV download

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Check, Pencil, Package, TrendingUp, Building2,
  AlertTriangle, Loader2, Download, History, X, Plus, Trash2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTierStats, useRecentTierChanges, useAllTierChanges, useExportBilling, useCreatePackage, useDeletePackage } from '../../hooks/usePackageTiers';

// OLD MOCK DATA — commented out in favour of real API data
// const TIERS = [
//   { id: 'basic',      name: 'Basic',      price: 149,  tenantCount: 38, modules: ['KSeFFlow', 'WorkPulse'],              limits: { users: 10,  storage: '5 GB',   apiCalls: '10k / mo'  }, color: 'border-slate-200', highlight: false },
//   { id: 'pro',        name: 'Pro',        price: 399,  tenantCount: 71, modules: ['KSeFFlow','WorkPulse','SafeWork',...], limits: { users: 50,  storage: '25 GB',  apiCalls: '100k / mo' }, color: 'border-red-400',   highlight: true  },
//   { id: 'enterprise', name: 'Enterprise', price: 999,  tenantCount: 33, modules: [...,'PrivacyPilot'],                   limits: { users: 'Unlimited', storage: '500 GB', apiCalls: 'Unlimited' }, color: 'border-slate-900', highlight: false },
// ];
// const CHANGE_LOG = [ ... ];

// Maps backend TenantModule enum values (KSEFFLOW) to display names (KSeFFlow).
const MODULE_LABELS = {
  KSEFFLOW:     'KSeFFlow',
  WORKPULSE:    'WorkPulse',
  SAFEWORK:     'SafeWork',
  SAFEVOICE:    'SafeVoice',
  WASTESYNC:    'WasteSync',
  PRIVACYPILOT: 'PrivacyPilot',
};

const ALL_MODULE_KEYS = Object.keys(MODULE_LABELS);

// Border colour applied to each tier card — cycles by index when there are >3 tiers.
const TIER_COLORS = ['border-slate-200', 'border-red-400', 'border-slate-900'];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Skeleton block used in loading states
function Skel({ w = 'w-16', h = 'h-6' }) {
  return <div className={`${h} ${w} bg-slate-100 rounded animate-pulse`} />;
}

export default function PackageTiers() {
  // ── Server state ──────────────────────────────────────────────────────────
  const { data: tierStats,     isLoading: statsLoading,   error: statsError   } = useTierStats();
  const { data: recentChanges, isLoading: changesLoading, error: changesError } = useRecentTierChanges();
  const { refetch: fetchAllChanges, data: allChanges, isFetching: allFetching } = useAllTierChanges();
  const exportBilling = useExportBilling();
  const createPackage = useCreatePackage();
  const deletePackage = useDeletePackage();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showNewTier,     setShowNewTier]     = useState(false);
  // confirmDelete holds the tier object the user clicked delete on, or null when closed.
  const [confirmDelete,   setConfirmDelete]   = useState(null);

  // ── Carousel state ────────────────────────────────────────────────────────
  // activeIdx tracks the left-most visible card; used for dot indicators and
  // disabling the prev/next buttons at the edges.
  const carouselRef = useRef(null);
  const [activeIdx,  setActiveIdx]  = useState(0);

  // Each card slot = w-80 (320px) + gap-6 (24px) = 344px per step.
  const CARD_STEP = 344;

  const scrollToIdx = (idx) => {
    const clamped = Math.max(0, Math.min(idx, tiers.length - 1));
    setActiveIdx(clamped);
    carouselRef.current?.scrollTo({ left: clamped * CARD_STEP, behavior: 'smooth' });
  };

  // ── New Tier form state ───────────────────────────────────────────────────
  const EMPTY_FORM = {
    name: '', description: '', price: '', currency: 'EUR',
    durationType: 'MONTHLY', duration: '30',
    usersCapacity: '', appIds: [],
  };
  const [form, setForm] = useState(EMPTY_FORM);

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Auto-fill duration when the billing cycle changes
  const handleDurationTypeChange = (type) => {
    const defaults = { MONTHLY: '30', YEARLY: '365', LIFETIME: '36500', DAYS: '' };
    setForm((f) => ({ ...f, durationType: type, duration: defaults[type] ?? '' }));
  };

  const toggleModule = (key) =>
    setForm((f) => ({
      ...f,
      appIds: f.appIds.includes(key)
        ? f.appIds.filter((m) => m !== key)
        : [...f.appIds, key],
    }));

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (form.appIds.length === 0) {
      toast.error('Select at least one module.');
      return;
    }
    createPackage.mutate(
      {
        name:         form.name.trim(),
        description:  form.description.trim() || undefined,
        price:        parseFloat(form.price),
        currency:     form.currency,
        durationType: form.durationType,
        duration:     parseInt(form.duration, 10),
        usersCapacity: form.usersCapacity ? parseInt(form.usersCapacity, 10) : null,
        appIds:       form.appIds,
        status:       'ACTIVE',
      },
      {
        onSuccess: () => {
          setShowNewTier(false);
          setForm(EMPTY_FORM);
        },
      },
    );
  };

  const handleFullHistory = async () => {
    if (!allChanges) await fetchAllChanges();
    setShowFullHistory(true);
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const tiers              = tierStats?.tiers              ?? [];
  const totalMrr           = tierStats?.totalMrr           ?? 0;
  const payingTenants      = tierStats?.payingTenants      ?? 0;
  const mostPopularPlan    = tierStats?.mostPopularPlan    ?? '—';
  const mostPopularCount   = tierStats?.mostPopularPlanTenantCount ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">License Tiers</h2>
          <p className="text-sm text-slate-500 font-medium">
            Manage platform subscription packages and module entitlements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-4 py-2"
            onClick={() => exportBilling.mutate()}
            disabled={exportBilling.isPending}
          >
            {exportBilling.isPending
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Exporting…</>
              : <><Download className="h-3.5 w-3.5 mr-1.5" />Export Billing Report</>
            }
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold px-4 py-2 shadow-sm"
            onClick={() => setShowNewTier(true)}
          >
            <Package className="h-3.5 w-3.5 mr-1.5" /> New Tier
          </Button>
        </div>
      </div>

      {/* ── Stats error ───────────────────────────────────────────────────── */}
      {statsError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Failed to load tier stats: {statsError.message}
        </div>
      )}

      {/* ── MRR summary strip ─────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: 'Total MRR',
            value: statsLoading ? null : `€${Number(totalMrr).toLocaleString()}`,
            icon:  TrendingUp,
            sub:   'across all tiers',
          },
          {
            label: 'Paying Tenants',
            value: statsLoading ? null : payingTenants.toString(),
            icon:  Building2,
            sub:   'active subscriptions',
          },
          {
            label: 'Most Popular',
            value: statsLoading ? null : mostPopularPlan,
            icon:  Package,
            sub:   statsLoading ? '' : `${mostPopularCount} tenants`,
          },
        ].map((s) => (
          <Card key={s.label} className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {s.label}
              </CardTitle>
              <s.icon className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              {s.value === null
                ? <Skel w="w-24" h="h-8" />
                : <p className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>
              }
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tier cards ────────────────────────────────────────────────────── */}
      {statsLoading ? (
        // Skeleton tier cards
        <div className="grid gap-6 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-white shadow-sm rounded-2xl border-2 border-slate-100">
              <CardHeader className="pt-6 pb-2 space-y-2">
                <Skel w="w-20" h="h-5" />
                <Skel w="w-32" h="h-8" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skel w="w-24" h="h-10" />
                <div className="space-y-2">
                  {[...Array(6)].map((_, j) => <Skel key={j} w="w-full" h="h-4" />)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tiers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
          <Package className="h-10 w-10 text-slate-200" />
          <p className="text-sm font-semibold text-slate-500">No active tiers found.</p>
        </div>
      ) : (
        // Carousel wrapper — overflow is hidden so only the active card(s) are
        // visible; prev/next buttons and dot indicators drive programmatic scroll.
        <div className="relative">

          {/* Prev button */}
          <button
            onClick={() => scrollToIdx(activeIdx - 1)}
            disabled={activeIdx === 0}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-red-600 hover:border-red-300 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Scrollable track — scrollbar hidden; scrolled only via scrollToIdx */}
          <div
            ref={carouselRef}
            className="flex gap-6 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tiers.map((tier, idx) => {
              const tierModuleKeys = (tier.appIds ?? []).map((m) => m.toString().toUpperCase());
              const borderColor    = tier.mostPopular ? 'border-red-400' : TIER_COLORS[idx] ?? 'border-slate-200';

              return (
                // Each card is fixed at w-80 (320px); CARD_STEP = 320 + gap-6(24) = 344px.
                <div key={tier.packageId} className="flex-none w-80">
                  <Card
                    className={`bg-white shadow-sm rounded-2xl border-2 relative overflow-hidden transition-shadow hover:shadow-md h-full ${borderColor}`}
                  >
                    {tier.mostPopular && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
                    )}

                    <CardHeader className="pt-6 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          {tier.mostPopular && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full mb-2 inline-block">
                              Most Popular
                            </span>
                          )}
                          <CardTitle className="text-xl font-black text-slate-900">
                            {tier.packageName}
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                            {tier.tenantCount} active tenants
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => toast.info(`Edit ${tier.packageName} tier — coming soon`)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            onClick={() => setConfirmDelete(tier)}
                            disabled={deletePackage.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      {/* Price */}
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-slate-900">
                          {tier.currency === 'EUR' ? '€' : tier.currency}
                          {Number(tier.price).toLocaleString()}
                        </span>
                        <span className="text-sm text-slate-400 font-medium">/ mo</span>
                      </div>

                      {/* Users limit — Storage and API Calls removed per product decision */}
                      <div className="inline-block bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Users</p>
                        <p className="text-xs font-black text-slate-700 mt-0.5">
                          {tier.usersCapacity != null ? tier.usersCapacity.toLocaleString() : 'Unlimited'}
                        </p>
                      </div>

                      {/* Module access checklist */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                          Modules
                        </p>
                        {ALL_MODULE_KEYS.map((key) => {
                          const included = tierModuleKeys.includes(key);
                          return (
                            <div
                              key={key}
                              className={`flex items-center gap-2 text-xs font-medium ${
                                included ? 'text-slate-700' : 'text-slate-300'
                              }`}
                            >
                              <Check
                                className={`h-3.5 w-3.5 flex-shrink-0 ${
                                  included ? 'text-emerald-500' : 'text-slate-200'
                                }`}
                              />
                              {MODULE_LABELS[key]}
                            </div>
                          );
                        })}
                      </div>

                      {/* Tier MRR */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Tier MRR
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          €{Number(tier.tierMrr).toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Next button */}
          <button
            onClick={() => scrollToIdx(activeIdx + 1)}
            disabled={activeIdx >= tiers.length - 1}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-red-600 hover:border-red-300 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dot indicators — one dot per tier; active dot is wider and red */}
          {tiers.length > 1 && (
            <div className="flex justify-center gap-2 mt-5">
              {tiers.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToIdx(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIdx
                      ? 'w-6 bg-red-500'
                      : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Recent tier change log ─────────────────────────────────────────── */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-800">Recent Plan Assignments</h2>
            <button
              onClick={handleFullHistory}
              disabled={allFetching}
              className="flex items-center gap-1 text-[10px] text-red-600 font-bold cursor-pointer uppercase tracking-wider hover:underline disabled:opacity-50"
            >
              {allFetching
                ? <><Loader2 className="h-3 w-3 animate-spin" />Loading…</>
                : <><History className="h-3 w-3" />Full History</>
              }
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {changesError ? (
            <div className="px-6 py-8 flex items-center gap-2 text-rose-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Failed to load tier changes: {changesError.message}
            </div>
          ) : changesLoading ? (
            <div className="divide-y divide-slate-50">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                  <Skel w="w-36" h="h-4" />
                  <Skel w="w-16" h="h-5" />
                  <Skel w="w-4"  h="h-3" />
                  <Skel w="w-16" h="h-5" />
                  <Skel w="w-28" h="h-4" />
                  <Skel w="w-20" h="h-4" />
                </div>
              ))}
            </div>
          ) : !recentChanges || recentChanges.length === 0 ? (
            <div className="px-6 py-12 flex flex-col items-center gap-2 text-slate-400">
              <History className="h-8 w-8 text-slate-200" />
              <p className="text-sm font-medium text-slate-500">No plan assignments recorded yet.</p>
            </div>
          ) : (
            <TierChangeTable rows={recentChanges} />
          )}
        </CardContent>
      </Card>

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <Card className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border-slate-200">
            <CardHeader className="pt-6 pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-rose-50">
                  <Trash2 className="h-5 w-5 text-rose-600" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">Delete Package</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-6 space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete{' '}
                <span className="font-bold text-slate-900">{confirmDelete.packageName}</span>?
                {confirmDelete.tenantCount > 0 && (
                  <span className="block mt-1 text-rose-600 font-medium">
                    Warning: {confirmDelete.tenantCount} tenant
                    {confirmDelete.tenantCount !== 1 ? 's are' : ' is'} currently on this plan.
                    Their package assignment will be cleared.
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-200 text-slate-600 font-bold"
                  onClick={() => setConfirmDelete(null)}
                  disabled={deletePackage.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-rose-600 text-white hover:bg-rose-700 font-bold"
                  disabled={deletePackage.isPending}
                  onClick={() =>
                    deletePackage.mutate(confirmDelete.packageId, {
                      onSuccess: () => setConfirmDelete(null),
                    })
                  }
                >
                  {deletePackage.isPending
                    ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Deleting…</>
                    : 'Delete'
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── New Tier modal ───────────────────────────────────────────────── */}
      {showNewTier && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <Card className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border-slate-200 max-h-[90vh] flex flex-col">

            <CardHeader className="border-b border-slate-100 py-5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-red-50">
                    <Plus className="h-4 w-4 text-red-600" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900">New Package Tier</CardTitle>
                </div>
                <button
                  onClick={() => { setShowNewTier(false); setForm(EMPTY_FORM); }}
                  disabled={createPackage.isPending}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>

            <div className="overflow-y-auto flex-1">
              <form id="new-tier-form" onSubmit={handleCreateSubmit}>
                <CardContent className="pt-6 space-y-5">

                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Package Name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Enterprise"
                      className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      required
                      disabled={createPackage.isPending}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Description <span className="text-slate-300 font-normal normal-case">(optional)</span>
                    </Label>
                    <textarea
                      placeholder="Short description shown to admins…"
                      rows={2}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none disabled:opacity-50"
                      value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                      disabled={createPackage.isPending}
                    />
                  </div>

                  {/* Price + Currency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Price / mo <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="399"
                        className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                        value={form.price}
                        onChange={(e) => setField('price', e.target.value)}
                        required
                        disabled={createPackage.isPending}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Currency</Label>
                      <select
                        className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white disabled:opacity-50"
                        value={form.currency}
                        onChange={(e) => setField('currency', e.target.value)}
                        disabled={createPackage.isPending}
                      >
                        <option value="EUR">EUR €</option>
                        <option value="PLN">PLN zł</option>
                      </select>
                    </div>
                  </div>

                  {/* Billing cycle + Duration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Billing Cycle <span className="text-rose-500">*</span>
                      </Label>
                      <select
                        className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white disabled:opacity-50"
                        value={form.durationType}
                        onChange={(e) => handleDurationTypeChange(e.target.value)}
                        disabled={createPackage.isPending}
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                        <option value="DAYS">Custom (days)</option>
                        <option value="LIFETIME">Lifetime</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Duration (days) <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="30"
                        className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                        value={form.duration}
                        onChange={(e) => setField('duration', e.target.value)}
                        required
                        disabled={createPackage.isPending}
                      />
                    </div>
                  </div>

                  {/* Users Capacity */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      User Seats{' '}
                      <span className="text-slate-300 font-normal normal-case">(leave blank for unlimited)</span>
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="50"
                      className="h-10 border-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                      value={form.usersCapacity}
                      onChange={(e) => setField('usersCapacity', e.target.value)}
                      disabled={createPackage.isPending}
                    />
                  </div>

                  {/* Module selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Modules <span className="text-rose-500">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_MODULE_KEYS.map((key) => {
                        const selected = form.appIds.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleModule(key)}
                            disabled={createPackage.isPending}
                            className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-all text-left ${
                              selected
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-red-300'
                            }`}
                          >
                            <Check className={`h-3.5 w-3.5 flex-shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                            {MODULE_LABELS[key]}
                          </button>
                        );
                      })}
                    </div>
                    {form.appIds.length === 0 && (
                      <p className="text-[10px] text-rose-500 font-medium">At least one module required.</p>
                    )}
                  </div>

                </CardContent>
              </form>
            </div>

            {/* Sticky footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowNewTier(false); setForm(EMPTY_FORM); }}
                className="flex-1 text-slate-400 font-bold"
                disabled={createPackage.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="new-tier-form"
                className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold"
                disabled={createPackage.isPending || form.appIds.length === 0}
              >
                {createPackage.isPending
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Creating…</>
                  : 'Create Tier'
                }
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Full History modal ────────────────────────────────────────────── */}
      {showFullHistory && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <Card className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border-slate-200 max-h-[80vh] flex flex-col">
            <CardHeader className="border-b border-slate-100 py-5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900">
                  Full Plan Assignment History
                </CardTitle>
                <button
                  onClick={() => setShowFullHistory(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-wider"
                >
                  Close
                </button>
              </div>
            </CardHeader>
            <div className="overflow-y-auto flex-1">
              {!allChanges || allChanges.length === 0 ? (
                <div className="px-6 py-12 flex flex-col items-center gap-2 text-slate-400">
                  <History className="h-8 w-8 text-slate-200" />
                  <p className="text-sm font-medium text-slate-500">No plan assignments recorded yet.</p>
                </div>
              ) : (
                <TierChangeTable rows={allChanges} />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Shared between the recent-assignments card and the full-history modal.
// Columns: Tenant | Package | Assigned | Expires | Reason
// OLD columns (From / To) removed — backend now returns all assignment events,
// not just plan-change diffs, so "fromPlan" is always null.
function TierChangeTable({ rows }) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/50">
        <TableRow className="hover:bg-transparent border-b border-slate-100">
          <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tenant</TableHead>
          <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Package</TableHead>
          <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned</TableHead>
          <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Expires</TableHead>
          <TableHead className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((log, i) => (
          <TableRow key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
            <TableCell className="px-6 py-4 text-xs font-semibold text-slate-700">
              {log.tenantName}
            </TableCell>
            <TableCell className="px-6 py-4">
              <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest text-red-600 border-red-200 bg-red-50">
                {log.toPlan ?? '—'}
              </Badge>
            </TableCell>
            <TableCell className="px-6 py-4 text-xs text-slate-500 font-medium">
              {formatDate(log.changedAt)}
            </TableCell>
            <TableCell className="px-6 py-4 text-xs text-slate-500 font-medium">
              {log.planExpiring
                ? formatDate(log.planExpiring)
                : <span className="text-slate-300 italic">—</span>
              }
            </TableCell>
            <TableCell className="px-6 py-4 text-xs text-slate-500">
              {log.reason ?? <span className="text-slate-300 italic">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
