import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2, ArrowLeft, Mail, Phone, MapPin, Hash, Calendar,
  Package, Clock, Loader2, AlertTriangle, CheckCircle2, XCircle, PauseCircle,
} from 'lucide-react';
import { useTenantById } from '../../hooks/useTenant';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  ACTIVE:    { dot: 'bg-emerald-500', text: 'text-emerald-700', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  INACTIVE:  { dot: 'bg-slate-400',   text: 'text-slate-600',   badge: 'border-slate-200 bg-slate-50 text-slate-600' },
  SUSPENDED: { dot: 'bg-rose-500',    text: 'text-rose-700',    badge: 'border-rose-200 bg-rose-50 text-rose-700' },
};

const PKG_STATUS_STYLES = {
  ACTIVE:   'border-emerald-200 bg-emerald-50 text-emerald-700',
  INACTIVE: 'border-slate-200 bg-slate-50 text-slate-600',
  EXPIRED:  'border-rose-200 bg-rose-50 text-rose-700',
};

const MODULE_LABELS = {
  KSEFFLOW:    'KSeF Flow',
  WORKPULSE:   'WorkPulse',
  SAFEWORK:    'SafeWork',
  SAFEVOICE:   'SafeVoice',
  WASTESYNC:   'WasteSync',
  PRIVACYPILOT:'PrivacyPilot',
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-700 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

function PackageCard({ pkg, isCurrent }) {
  if (!pkg) return null;
  const statusCls = PKG_STATUS_STYLES[pkg.status] ?? PKG_STATUS_STYLES.INACTIVE;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isCurrent ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-800 text-sm">{pkg.name}</p>
          {pkg.description && (
            <p className="text-xs text-slate-500 mt-0.5">{pkg.description}</p>
          )}
        </div>
        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${statusCls}`}>
          {pkg.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {pkg.price != null && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Price</p>
            <p className="font-semibold text-slate-700">{pkg.price} {pkg.currency ?? 'PLN'}</p>
          </div>
        )}
        {pkg.durationType && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duration</p>
            <p className="font-semibold text-slate-700">{pkg.durationType}</p>
          </div>
        )}
        {pkg.startingDate && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start</p>
            <p className="font-semibold text-slate-700">{fmt(pkg.startingDate)}</p>
          </div>
        )}
        {pkg.expiringDate && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expires</p>
            <p className="font-semibold text-slate-700">{fmt(pkg.expiringDate)}</p>
          </div>
        )}
      </div>

      {pkg.appIds?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Modules</p>
          <div className="flex flex-wrap gap-1.5">
            {pkg.appIds.map((mod) => (
              <span
                key={mod}
                className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wide border border-red-200"
              >
                {MODULE_LABELS[mod] ?? mod}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { data: tenant, isLoading, isError, error } = useTenantById(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm font-medium">Loading tenant…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-rose-500">
        <AlertTriangle className="h-8 w-8" />
        <span className="text-sm font-semibold">{error?.message ?? 'Tenant not found'}</span>
        <Button variant="outline" className="mt-2 border-slate-200" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go back
        </Button>
      </div>
    );
  }

  const s = STATUS_STYLES[tenant.status] ?? STATUS_STYLES.INACTIVE;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-200 shrink-0">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{tenant.name}</h1>
              <p className="text-xs text-slate-400 font-mono tracking-tight">ID: {tenant.id}</p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${s.badge}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{tenant.status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Company Info ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-5">
              <InfoRow icon={Hash}     label="NIP (Tax Number)"  value={tenant.nip} />
              <InfoRow icon={Hash}     label="REGON"             value={tenant.regon} />
              <InfoRow icon={Mail}     label="Email"             value={tenant.email} />
              <InfoRow icon={Phone}    label="Phone"             value={tenant.phone} />
              <InfoRow icon={MapPin}   label="Address"           value={tenant.address} />
              <InfoRow icon={MapPin}   label="City"              value={tenant.city && tenant.postalCode ? `${tenant.city}, ${tenant.postalCode}` : (tenant.city ?? tenant.postalCode)} />
              <InfoRow icon={Calendar} label="Registered"        value={fmt(tenant.createdAt)} />
              <InfoRow icon={Clock}    label="Last Updated"      value={fmt(tenant.updatedAt)} />
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Package ── */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Package className="h-4 w-4 text-red-500" /> Current Package
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 px-4">
              {tenant.currentPackage ? (
                <PackageCard pkg={tenant.currentPackage} isCurrent />
              ) : (
                <div className="flex flex-col items-center py-6 gap-2 text-slate-400">
                  <Package className="h-8 w-8" />
                  <span className="text-xs font-medium">No package assigned</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Package History ── */}
      {tenant.packageHistory?.length > 0 && (
        <Card className="border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" /> Package History ({tenant.packageHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {tenant.packageHistory.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} isCurrent={false} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
