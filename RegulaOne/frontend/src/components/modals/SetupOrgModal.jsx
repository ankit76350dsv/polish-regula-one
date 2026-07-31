import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { tenantService } from '../../services/tenantService';
import { authService } from '../../services/authService';
import { useAuthStore, mapApiUserToProfile } from '../../store/authStore';

function validationError(form) {
  const name = form.name.trim();
  const nip = form.nip.trim();
  const regon = form.regon.trim();
  const email = form.email.trim();
  const phone = form.phone.trim();
  const city = form.city.trim();
  const postalCode = form.postalCode.trim();

  if (!name) return 'Company name is required';
  if (name.length < 2 || name.length > 200) return 'Company name must be between 2 and 200 characters';
  if (!nip) return 'NIP is required';
  if (!/^\d{10}$/.test(nip)) return 'NIP must be exactly 10 digits';
  if (regon && !/^(\d{9}|\d{14})$/.test(regon)) return 'REGON must be 9 or 14 digits';
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please provide a valid email address';
  if (phone && !/^[+]?[0-9\s\-()]{7,20}$/.test(phone)) return 'Please provide a valid phone number';
  if (city.length > 100) return 'City name must not exceed 100 characters';
  if (postalCode && !/^\d{2}-\d{3}$/.test(postalCode)) {
    return 'Postal code must match format XX-XXX (e.g. 00-001)';
  }
  return null;
}

function setupPayload(form) {
  const payload = Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim()]),
  );

  // Optional patterned fields must be omitted when blank; an empty string is
  // still a value and would correctly fail backend @Pattern validation.
  for (const field of ['regon', 'phone', 'address', 'city', 'postalCode']) {
    if (!payload[field]) delete payload[field];
  }
  return payload;
}

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
    mutationFn: (payload) => tenantService.setupOrg(payload),
    onSuccess: async () => {
      try {
        // Refresh the user profile so tenantId/tenantStatus are now populated
        // and DashboardLayout drops this modal automatically.
        const me = await authService.getMe();
        setUser(mapApiUserToProfile(me));
        toast.success('Organisation set up! Welcome to RegulaOne.');
      } catch (error) {
        toast.error(error?.message || 'Organisation was created, but the profile could not be refreshed.');
      }
    },
    onError: (error) => {
      toast.error(error?.message || 'Setup failed. Please try again.', { duration: 8000 });
    },
  });

  const handleSetup = () => {
    const message = validationError(form);
    if (message) {
      toast.error(message, { duration: 8000 });
      return;
    }
    submit.mutate(setupPayload(form));
  };

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
            onClick={handleSetup}
            disabled={submit.isPending}
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
