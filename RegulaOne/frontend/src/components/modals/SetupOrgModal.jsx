import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { tenantService } from '../../services/tenantService';
import { authService } from '../../services/authService';
import { useAuthStore, mapApiUserToProfile } from '../../store/authStore';

// Shown to ROLE_ADMIN when tenantId is null (first login, no org linked yet).
// Non-dismissable — admin must complete setup before accessing the dashboard.
export default function SetupOrgModal() {
  const { user, setUser } = useAuthStore();

  const [form, setForm] = useState({
    name: '', nip: '', regon: '',
    // Pre-filled from the logged-in admin's account — not editable
    email: user?.email ?? '',
    phone: '', address: '', city: '', postalCode: '',
  });

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = useMutation({
    mutationFn: () => tenantService.setupOrg(form),
    onSuccess: async () => {
      toast.success('Organisation set up! Welcome to RegulaOne.');
      // Refresh the user profile so tenantId/tenantStatus are now populated
      // and DashboardLayout drops this modal automatically.
      const me = await authService.getMe();
      setUser(mapApiUserToProfile(me));
    },
    onError: (e) => toast.error(e.message || 'Setup failed. Please try again.'),
  });

  const canSubmit = form.name.trim() && form.nip.trim() && form.email.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-red-700 px-8 py-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">RegulaOne</span>
          </div>
          <h2 className="text-xl font-bold">Set Up Your Organisation</h2>
          <p className="text-red-200 text-sm mt-1">
            Complete your company details to unlock the compliance dashboard.
          </p>
        </div>

        {/* Form */}
        <div className="px-8 py-6 space-y-4 max-h-[55vh] overflow-y-auto">
          <Field
            label="Company Legal Name *"
            value={form.name}
            onChange={set('name')}
            placeholder="PolCorp Sp. z o.o."
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="NIP (Tax No.) *"
              value={form.nip}
              onChange={set('nip')}
              placeholder="1234567890"
              maxLength={10}
            />
            <Field
              label="REGON"
              value={form.regon}
              onChange={set('regon')}
              placeholder="123456789"
            />
          </div>

          <Field
            label="Contact Email"
            value={form.email}
            readOnly
            type="email"
            className="bg-slate-50 cursor-not-allowed text-slate-500"
          />

          <Field
            label="Phone"
            value={form.phone}
            onChange={set('phone')}
            placeholder="+48 123 456 789"
          />

          <Field
            label="Street Address"
            value={form.address}
            onChange={set('address')}
            placeholder="ul. Marszałkowska 1"
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="City"
              value={form.city}
              onChange={set('city')}
              placeholder="Warszawa"
            />
            <Field
              label="Postal Code"
              value={form.postalCode}
              onChange={set('postalCode')}
              placeholder="00-001"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-400">* Required fields</p>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !canSubmit}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {submit.isPending ? 'Setting up…' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, className = '', ...props }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <input
        className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition ${className}`}
        {...props}
      />
    </div>
  );
}
