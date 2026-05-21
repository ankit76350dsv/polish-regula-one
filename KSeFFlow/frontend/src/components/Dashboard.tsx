import { Invoice, Certificate, Tenant, UserRole } from '../types';
import { 
  Building2, 
  FileCheck2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  TrendingUp, 
  Activity, 
  RefreshCw, 
  Database,
  ArrowUpRight,
  ExternalLink
} from 'lucide-react';

interface DashboardProps {
  tenant: Tenant;
  invoices: Invoice[];
  certificates: Certificate[];
  onNavigate: (page: string) => void;
  govStatus: 'Connected' | 'Restricted' | 'Disconnected' | 'Downtime Sim';
  role: UserRole;
}

export default function Dashboard({ tenant, invoices, certificates, onNavigate, govStatus, role }: DashboardProps) {
  // Filter invoices for active tenant
  const tenantInvoices = invoices.filter(inv => inv.tenantId === tenant.id);
  const totalInvoices = tenantInvoices.length;
  const sentInvoices = tenantInvoices.filter(inv => inv.status === 'SENT').length;
  const offlineInvoices = tenantInvoices.filter(inv => inv.status === 'OFFLINE_MODE').length;
  const draftInvoices = tenantInvoices.filter(inv => inv.status === 'DRAFT').length;

  // Totals calculations (converting EUR to approx PLN 4.3 for dashboard visual aggregation if mixed)
  const totalNetPLN = tenantInvoices.reduce((acc, inv) => {
    if (inv.status === 'DRAFT') return acc;
    const rate = inv.currency === 'EUR' ? 4.3 : 1;
    return acc + (inv.totalNet * rate);
  }, 0);

  const totalVatPLN = tenantInvoices.reduce((acc, inv) => {
    if (inv.status === 'DRAFT') return acc;
    const rate = inv.currency === 'EUR' ? 4.3 : 1;
    return acc + (inv.totalVat * rate);
  }, 0);

  const totalGrossPLN = totalNetPLN + totalVatPLN;

  // Active qualified certs
  const activeCerts = certificates.filter(
    c => c.tenantId === tenant.id && c.verificationStatus === 'VERIFIED'
  );

  // Status computation
  const successRate = totalInvoices - draftInvoices > 0
    ? Math.round((sentInvoices / (totalInvoices - draftInvoices)) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Top Welcome Title Banner in Clean Minimalism */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">
            Poland e-Invoicing Compliance Hub (KSeF FA(3) Protocol)
          </span>
          <h1 className="text-3xl font-light text-slate-800 tracking-tight">
            {tenant.name}
          </h1>
          <p className="text-slate-500 text-xs mt-1.5 font-sans flex items-center gap-2">
            Workspace Tax NIP ID: <strong className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-bold">{tenant.nip}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-xs shrink-0">
          <div className="px-1 text-center">
            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Verification Role</div>
            <div className="text-xs font-bold font-mono text-slate-700 mt-0.5">{role}</div>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="px-1 text-center">
            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Subscribed Tier</div>
            <div className="text-xs font-bold text-slate-700 mt-0.5">{tenant.subscriptionPlan}</div>
          </div>
        </div>
      </div>

      {/* Main SaaS Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-201 rounded-xl p-5 hover:border-slate-300 transition-all shadow-xs flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Total Financial Volume</span>
            <div className="text-2xl font-semibold font-sans text-slate-800 tracking-tight">
              {totalGrossPLN.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold flex items-center">
                Net: {totalNetPLN.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 })}
              </span>
            </p>
          </div>
          <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-201 rounded-xl p-5 hover:border-slate-300 transition-all shadow-xs flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">KSeF Sent / Drafts</span>
            <div className="text-2xl font-semibold font-sans text-slate-800 tracking-tight">
              {sentInvoices} <span className="text-slate-300 font-light text-xl">/</span> {draftInvoices}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              {sentInvoices} declared in Krajowy System
            </p>
          </div>
          <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
            <FileCheck2 size={18} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-201 rounded-xl p-5 hover:border-slate-300 transition-all shadow-xs flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Government Success Rate</span>
            <div className="text-2xl font-semibold font-sans text-slate-800 tracking-tight">
              {successRate}%
            </div>
            <p className="text-xs text-slate-550 flex items-center gap-1">
              <Activity size={12} className="text-emerald-500" />
              Realtime submission KPI
            </p>
          </div>
          <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
            <ShieldCheck size={18} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-201 rounded-xl p-5 hover:border-slate-300 transition-all shadow-xs flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Offline Fallback Queue</span>
            <div className="text-2xl font-semibold font-sans text-emerald-650 tracking-tight">
              {offlineInvoices} <span className="text-xs text-slate-400 font-normal">Pending</span>
            </div>
            <p className="text-xs text-orange-650 font-medium flex items-center gap-1">
              {offlineInvoices > 0 ? (
                <>
                  <AlertTriangle size={12} />
                  Automatic RabbitMQ retry active
                </>
              ) : (
                "No backlogged local cache"
              )}
            </p>
          </div>
          <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-100">
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* Main Center Layout: Live Charts, Gov Integration Status Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Compliance and Integration Center Module (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg text-slate-800 tracking-tight">Government Integration Center</h3>
                <p className="text-slate-400 text-xs">Direct encrypted tunnel with Ministry of Finance (Krajowy System e-Faktur)</p>
              </div>
              <button 
                onClick={() => onNavigate('integration')}
                className="text-red-600 font-semibold text-xs hover:text-red-700 flex items-center gap-1 bg-red-50/55 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 transition"
              >
                Access Center <ArrowUpRight size={14} />
              </button>
            </div>

            {/* Gov API Health diagnostics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-150 p-4 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Government System</span>
                <p className="font-semibold text-slate-700 text-xs flex items-center gap-1.5 mt-1">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${govStatus === 'Connected' ? 'bg-emerald-550 animation-pulse' : 'bg-amber-500'}`}></span>
                  Poland KSeF Sandbox
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">API Connection Status</span>
                <p className="font-mono text-slate-700 text-xs font-semibold mt-1">
                  {govStatus === 'Connected' ? 'HTTP 200 OK' : 'LOCAL FALLBACK'}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Sec Key Authority</span>
                <p className="font-medium text-slate-700 text-xs mt-1 flex items-center gap-1.5">
                  <Database size={13} className="text-slate-400" />
                  {activeCerts.length > 0 ? activeCerts[0].fileName : "No Active Key"}
                </p>
              </div>
            </div>

            {/* Custom SVG Bar Chart as fully responsive high-contrast graph */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Submission Volume & SLA Latency</span>
                <span className="text-slate-400 font-mono text-[11px]">Daily Average (PLN Thousands)</span>
              </div>
              <div className="w-full bg-slate-50 border border-slate-150 rounded-xl p-4">
                {/* Simulated Chart with dynamic SVG */}
                <svg viewBox="0 0 500 120" className="w-full h-28">
                  {/* Grid Lines */}
                  <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="60" x2="500" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="100" x2="500" y2="100" stroke="#e2e8f0" strokeWidth="1" />
                  
                  {/* Bars representing real Polish tax days */}
                  {/* Day 1: May 14 */}
                  <rect x="40" y="40" width="30" height="60" rx="4" fill="#DC2626" opacity="0.8" />
                  <text x="55" y="115" fontSize="8" fontFamily="sans-serif" textAnchor="middle" fill="#94a3b8">14/05</text>
                  
                  {/* Day 2: May 15 */}
                  <rect x="110" y="30" width="30" height="70" rx="4" fill="#DC2626" opacity="0.8" />
                  <text x="125" y="115" fontSize="8" fontFamily="sans-serif" textAnchor="middle" fill="#94a3b8">15/05</text>
                  
                  {/* Day 3: May 16 */}
                  <rect x="180" y="80" width="30" height="20" rx="4" fill="#DC2626" opacity="0.8" />
                  <text x="195" y="115" fontSize="8" fontFamily="sans-serif" textAnchor="middle" fill="#94a3b8">16/05</text>
 
                  {/* Day 4: May 17 */}
                  <rect x="250" y="85" width="30" height="15" rx="4" fill="#DC2626" opacity="0.8" />
                  <text x="265" y="115" fontSize="8" fontFamily="sans-serif" textAnchor="middle" fill="#94a3b8">17/05</text>
 
                  {/* Day 5: May 18 */}
                  <rect x="320" y="20" width="30" height="80" rx="4" fill="#DC2626" opacity="0.8" />
                  <text x="335" y="115" fontSize="8" fontFamily="sans-serif" textAnchor="middle" fill="#94a3b8">18/05</text>
 
                  {/* Day 6: May 19 */}
                  <rect x="390" y="55" width="30" height="45" rx="4" fill="#E11D48" opacity="0.8" /> {/* active offline day */}
                  <rect x="390" y="85" width="30" height="15" rx="4" fill="#cbd5e1" /> {/* Failed chunk */}
                  <text x="405" y="115" fontSize="8" fontFamily="sans-serif" textAnchor="middle" fill="#94a3b8">19/05</text>
 
                  {/* Day 7: May 20 */}
                  <rect x="460" y="65" width="30" height="35" rx="4" fill="#DC2626" opacity="0.9" />
                  <text x="475" y="115" fontSize="8" fontFamily="sans-serif" textAnchor="middle" fill="#94a3b8">Today</text>
                </svg>
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2 border-t pt-2 border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 bg-red-600 rounded-sm"></span> Successful KSeF Upload
                    <span className="inline-block w-2.5 h-2.5 bg-slate-200 rounded-sm"></span> Offline Queue Fallback
                  </div>
                  <div>Average Government API Ack Latency: <span className="font-mono font-semibold text-slate-600">345ms</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>UPO encryption key: <strong>ECC-Secp256k1</strong> (Government Compliance Certified)</span>
            <span className="flex items-center gap-1 text-red-600 font-semibold cursor-pointer hover:underline">
              System Health Check OK <RefreshCw size={11} className="animate-spin-slow" />
            </span>
          </div>
        </div>

        {/* Sidebar Mini panels (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Certificate Validity Alert Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h4 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2 border-b pb-2.5 border-slate-100">
              <ShieldCheck size={16} className="text-red-600" />
              Qualified Signatures
            </h4>
            <div className="space-y-4">
              {activeCerts.map((cert) => {
                const expiresDate = new Date(cert.validTo);
                const isNearExpiry = expiresDate.getTime() - new Date().getTime() < 1000 * 60 * 60 * 24 * 30; // 30 days
                return (
                  <div key={cert.id} className="border-b last:border-b-0 pb-3 last:pb-0 border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate max-w-[180px] block">{cert.fileName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold font-mono ${
                        isNearExpiry ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {isNearExpiry ? 'Expiring Soon' : 'ACTIVE'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Valid to: <strong>{cert.validTo}</strong></span>
                      <span>Type: <strong>{cert.type}</strong></span>
                    </div>
                  </div>
                );
              })}
              {activeCerts.length === 0 && (
                <div className="text-xs text-slate-400 py-2 text-center bg-slate-50 rounded-lg">
                  No active certificates loaded for this company. Upload verification credentials to enable digital sealing.
                </div>
              )}
            </div>
          </div>

          {/* Connected Compliance Integrations */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-red-400 text-[10px] uppercase tracking-widest">RegulaOne Suite Sync</h4>
                <h5 className="font-semibold text-white text-sm">Centralized Microservices</h5>
              </div>
              <Activity size={16} className="text-slate-400 animate-pulse" />
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <div className="flex flex-col">
                  <span className="font-medium text-white">WorkPulse ERP</span>
                  <span className="text-[10px] text-slate-400 leading-normal">Payroll and expense stream mapping</span>
                </div>
                <span className="text-[9px] bg-red-950 text-red-300 border border-red-900/50 font-semibold px-2 py-0.5 rounded">REST LINK</span>
              </div>

              <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <div className="flex flex-col">
                  <span className="font-medium text-white">SafeWork Audit</span>
                  <span className="text-[10px] text-slate-400 leading-normal">Contractor NIP whitelist sync</span>
                </div>
                <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-900/50 font-semibold px-2 py-0.5 rounded">R-MQ QUEUE</span>
              </div>

              <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <div className="flex flex-col">
                  <span className="font-medium text-white">PrivacyPilot GDPR</span>
                  <span className="text-[10px] text-slate-400 leading-normal">10-Yr invoice crypto retention</span>
                </div>
                <span className="text-[9px] bg-sky-950 text-sky-400 border border-sky-900/50 font-semibold px-2 py-0.5 rounded">CRYPTO LOCK</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
              <span>GDPR / RODO Legally Bound Compliance</span>
              <ExternalLink size={10} />
            </div>
          </div>
        </div>

      </div>

      {/* Quick Launch / Action deck */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h4 className="font-semibold text-slate-800 text-sm mb-4">Enterprise Daily Compliance Checklist</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div 
            onClick={() => onNavigate('create')}
            className="border border-slate-200 p-4 rounded-xl cursor-pointer hover:border-red-400 hover:bg-slate-50 hover:shadow-xs transition text-slate-800 flex items-center gap-3"
          >
            <div className="bg-red-50 text-red-650 p-2 rounded-lg font-bold text-xs">01</div>
            <div>
              <p className="font-semibold text-sm text-slate-700">Issue New Invoice</p>
              <p className="text-slate-400 text-xs">Dynamic form with XML validation</p>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('invoices')}
            className="border border-slate-200 p-4 rounded-xl cursor-pointer hover:border-red-400 hover:bg-slate-50 hover:shadow-xs transition text-slate-800 flex items-center gap-3"
          >
            <div className="bg-red-50 text-red-650 p-2 rounded-lg font-bold text-xs">02</div>
            <div>
              <p className="font-semibold text-sm text-slate-700">Track Validations</p>
              <p className="text-slate-400 text-xs">Download receipts & UPO PDFs</p>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('certificates')}
            className="border border-slate-200 p-4 rounded-xl cursor-pointer hover:border-red-400 hover:bg-slate-50 hover:shadow-xs transition text-slate-800 flex items-center gap-3"
          >
            <div className="bg-red-50 text-red-650 p-2 rounded-lg font-bold text-xs">03</div>
            <div>
              <p className="font-semibold text-sm text-slate-700">Qualified Signature</p>
              <p className="text-slate-400 text-xs">Inspect keys & token times</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
