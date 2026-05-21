import { useState } from 'react';
import { Invoice, Tenant, UserRole } from '../types';
import { 
  Search, 
  Filter, 
  QrCode, 
  Download, 
  FileText, 
  ExternalLink,
  CheckCircle,
  FileBadge,
  Clock,
  XCircle,
  TrendingDown,
  Info,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

interface InvoiceListProps {
  tenant: Tenant;
  role: UserRole;
  invoices: Invoice[];
  onAddNotification: (title: string, message: string, type: 'info' | 'success' | 'warn' | 'error') => void;
}

export default function InvoiceList({ tenant, role, invoices, onAddNotification }: InvoiceListProps) {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'OFFLINE_MODE' | 'DRAFT'>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Filter actual invoices for current tenant
  const tenantInvoices = invoices.filter(inv => inv.tenantId === tenant.id);

  const filteredInvoices = tenantInvoices.filter(inv => {
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.buyerNIP.includes(searchTerm);
    
    if (statusFilter === 'ALL') return matchesSearch;
    return inv.status === statusFilter && matchesSearch;
  });

  // Calculate stats for top of repository page
  const totalNetSum = filteredInvoices.reduce((sum, inv) => sum + inv.totalNet, 0);
  const totalGrossSum = filteredInvoices.reduce((sum, inv) => sum + inv.totalGross, 0);

  // Download logic mock
  const triggerUpoDownload = (invoice: Invoice) => {
    onAddNotification(
      'UPO Download Initiated', 
      `Generating cryptographically signed Urzędowe Poświadczenie Odbioru (UPO) for invoice ${invoice.invoiceNumber}. XML hash attached.`, 
      'success'
    );
  };

  const triggerXmlDownload = (invoice: Invoice) => {
    onAddNotification(
      'XML Exported', 
      `Invoice ${invoice.invoiceNumber} exported successfully as Polish government-compliant FA(3) structural format.`, 
      'info'
    );
  };  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Layers className="text-red-650" size={20} />
          Document &amp; Compliance Repository
        </h2>
        <p className="text-slate-400 text-xs mt-1">Explore historic records, verify audit stamps, and pull governmental UPO declarations.</p>
      </div>

      {/* Stats micro row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs font-sans">
        <div>
          <span className="text-slate-400 block pb-0.5 font-semibold uppercase tracking-wider text-[10px]">Active Repository Size</span>
          <strong className="text-slate-700 text-lg">{tenantInvoices.length} invoices</strong>
        </div>
        <div>
          <span className="text-slate-400 block pb-0.5 font-semibold uppercase tracking-wider text-[10px]">Filtered Gross Sum (PLN)</span>
          <strong className="text-slate-800 text-lg">
            {totalGrossSum.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block pb-0.5 font-semibold uppercase tracking-wider text-[10px]">Qualified Signature Status</span>
          <strong className="text-emerald-600 text-xs font-bold flex items-center gap-1 mt-1.5 font-sans">
            <CheckCircle size={14} /> ACTIVE &amp; AUDITED
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block pb-0.5 font-semibold uppercase tracking-wider text-[10px]">Legal Archive Policy</span>
          <strong className="text-slate-750 text-xs flex items-center gap-1 mt-1.5 font-sans font-bold">
            RODO 10-Year Safe S3
          </strong>
        </div>
      </div>

      {/* Main Search and grid section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Table list column (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-4 border-slate-100">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search size={14} />
              </span>
              <input 
                type="text"
                placeholder="Search Invoice #, NIP, Buyer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 bg-slate-50/50 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-450"
              />
            </div>

            {/* Filter Status Selector */}
            <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500">
              <Filter size={13} className="text-slate-400" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="SENT">Registered (SENT)</option>
                <option value="OFFLINE_MODE">Fallback Mode</option>
                <option value="DRAFT">Drafts (Local)</option>
              </select>
            </div>
          </div>

          {/* Table display */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs align-middle">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-widest font-semibold text-[9px]">
                  <th className="py-3 px-2">Number</th>
                  <th className="py-3 px-2">Buyer Name / NIP</th>
                  <th className="py-3 px-2">Date</th>
                  <th className="py-3 px-2 text-right">Total (Gross)</th>
                  <th className="py-3 px-3">KSeF ID / Status</th>
                  <th className="py-3 px-2 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredInvoices.map((inv) => (
                  <tr 
                    key={inv.id} 
                    onClick={() => setSelectedInvoice(inv)}
                    className={`hover:bg-slate-50/70 transition cursor-pointer ${selectedInvoice?.id === inv.id ? 'bg-slate-100/50' : ''}`}
                  >
                    <td className="py-3.5 px-2 font-mono font-bold text-slate-800">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-2">
                      <div className="text-slate-700 truncate max-w-[150px] font-semibold">{inv.buyerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">NIP: {inv.buyerNIP}</div>
                    </td>
                    <td className="py-3.5 px-2 text-slate-400 font-mono">
                      {inv.issueDate}
                    </td>
                    <td className="py-3.5 px-2 text-right font-semibold font-mono text-slate-750">
                      {inv.totalGross.toLocaleString('pl-PL')} <span className="text-[10px] text-slate-400 font-normal">{inv.currency}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      {inv.status === 'SENT' ? (
                        <div className="flex flex-col">
                          <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700">
                            ● KSeF SECURE
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px] mt-0.5">{inv.ksefId}</span>
                        </div>
                      ) : inv.status === 'OFFLINE_MODE' ? (
                        <div className="flex flex-col">
                          <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            ● FALLBACK QUEUE
                          </span>
                          <span className="text-[9px] text-slate-500 mt-0.5">Auto retry count: {inv.submissionAttempts}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-205">
                          ● DRAFT LOCAL
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-2 text-center">
                      <button className="text-slate-400 hover:text-red-650 p-1 rounded-md transition inline-flex items-center gap-1 text-[10px] font-semibold">
                        Inspect <ArrowRight size={12} className="text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                      No invoices found matching criteria. Clear filters or create a new invoice in compliant sandbox.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Details Panel context (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {selectedInvoice ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
              
              {/* Heading */}
              <div className="border-b pb-3 border-slate-100">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Metadata Compliance Inspector</div>
                <h4 className="text-sm font-bold text-slate-800 font-mono mt-1">{selectedInvoice.invoiceNumber}</h4>
              </div>

              {/* Status details card */}
              <div className="space-y-4 text-xs font-sans">
                
                {selectedInvoice.status === 'SENT' ? (
                  /* Official Polish Government UPO Receipt View */
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                      <span className="text-red-750 text-[10px] uppercase font-bold flex items-center gap-1">
                        <FileBadge size={14} /> Ministry of Finance UPO
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Verified Stamp</span>
                    </div>

                    <div className="space-y-1.5 font-mono text-[10.5px] leading-relaxed text-slate-600">
                      <p>KSeF-ID (Official Token):</p>
                      <p className="font-bold text-slate-900 bg-slate-100 p-1.5 rounded text-[10px] break-all border border-slate-200">{selectedInvoice.ksefId}</p>
                      
                      <p className="mt-2">Reception Stamp Time:</p>
                      <p className="font-bold text-slate-850">{selectedInvoice.upoTimestamp || "2026-05-20T09:20:50"}</p>
                      
                      <p className="mt-2">Digest Hash (SHA-256):</p>
                      <p className="text-[8.5px] text-slate-400 break-all leading-normal">
                        e1a3bc32def0928e46bc9fae15093cd0c8db42110c4902a9cf293418efd927c9
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => triggerUpoDownload(selectedInvoice)}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] inline-flex items-center justify-center gap-1 transition"
                      >
                        <Download size={11} /> Download UPO
                      </button>
                      <button 
                        onClick={() => triggerXmlDownload(selectedInvoice)}
                        className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-[10px] inline-flex items-center justify-center gap-1 transition"
                      >
                        <FileText size={11} /> Export XML
                      </button>
                    </div>
                  </div>
                ) : selectedInvoice.status === 'OFFLINE_MODE' ? (
                  /* Offline fallback QR stamp */
                  <div className="bg-orange-50/50 border border-orange-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b pb-2 border-orange-200">
                      <span className="text-orange-950 text-[10px] uppercase font-bold flex items-center gap-1">
                        <QrCode size={14} className="text-orange-700" /> Offline QR Verification
                      </span>
                      <span className="text-[10px] font-mono text-orange-700 font-semibold">Legal Emergency Fallback</span>
                    </div>

                    <div className="flex flex-col items-center py-2 bg-white rounded-lg border border-orange-100">
                      {/* Simple visual SVG mock placeholder of custom QR verification */}
                      <svg viewBox="0 0 100 100" className="w-24 h-24 text-slate-800">
                        {/* Outer corners / typical QR squares */}
                        <rect x="10" y="10" width="25" height="25" fill="#E11D48" strokeWidth="1" />
                        <rect x="15" y="15" width="15" height="15" fill="#ffffff" />
                        <rect x="19" y="19" width="7" height="7" fill="#E11D48" />
                        
                        <rect x="65" y="10" width="25" height="25" fill="#E11D48" strokeWidth="1" />
                        <rect x="70" y="15" width="15" height="15" fill="#ffffff" />
                        <rect x="74" y="19" width="7" height="7" fill="#E11D48" />

                        <rect x="10" y="65" width="25" height="25" fill="#E11D48" strokeWidth="1" />
                        <rect x="15" y="70" width="15" height="15" fill="#ffffff" />
                        <rect x="19" y="74" width="7" height="7" fill="#E11D48" />

                        {/* Middle noise vectors representing signed hash */}
                        <rect x="45" y="45" width="10" height="10" fill="currentColor" />
                        <rect x="55" y="55" width="10" height="10" fill="currentColor" />
                        <rect x="40" y="20" width="5" height="15" fill="currentColor" opacity="0.8" />
                        <rect x="25" y="40" width="15" height="5" fill="currentColor" opacity="0.8" />
                        <rect x="65" y="65" width="15" height="10" fill="currentColor" />
                        <rect x="80" y="80" width="10" height="10" fill="currentColor" />
                        <rect x="45" y="80" width="12" height="6" fill="#E11D48" />
                      </svg>
                      <span className="text-[10px] text-slate-400 mt-2 font-mono">Scan code under Art. 106fa</span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-amber-900">
                      Under statutory Polish tax provisions, this offline invoice is a legal instrument. Central registration will complete automatically through the queue retry system.
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center text-slate-500 py-6">
                    <Info size={20} className="mx-auto text-slate-400 mb-1.5" />
                    <p className="text-xs">
                      This is a <strong>Local Draft invoice</strong> pending signature sealing. Complete KSeF registration to acquire a verified UPO réception stamp.
                    </p>
                  </div>
                )}

                {/* Core transaction outline */}
                <div className="space-y-2 border-t pt-3 border-slate-100 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Buyer:</span>
                    <span className="font-semibold text-slate-750 text-right truncate max-w-[150px]">{selectedInvoice.buyerName}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400 font-sans font-medium">NIP:</span>
                    <span className="text-slate-700 font-bold">{selectedInvoice.buyerNIP}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400 font-sans font-medium">Pre-tax Net:</span>
                    <span>{selectedInvoice.totalNet.toLocaleString()} {selectedInvoice.currency}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400 font-sans font-medium">VAT Total:</span>
                    <span>{selectedInvoice.totalVat.toLocaleString()} {selectedInvoice.currency}</span>
                  </div>
                  <div className="flex justify-between font-mono text-slate-900 font-bold border-t pt-1.5">
                    <span className="font-sans text-slate-800">Gross total:</span>
                    <span className="text-red-650">{selectedInvoice.totalGross.toLocaleString()} {selectedInvoice.currency}</span>
                  </div>
                </div>

                {/* List item details summary */}
                <div className="bg-slate-50 p-3 rounded-lg text-[11px] border border-slate-150">
                  <p className="font-bold text-slate-500 mb-1">Product lines included:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                    {selectedInvoice.items.map(item => (
                      <li key={item.id} className="truncate">
                        {item.quantity}x {item.productName || 'Custom item'} - {item.grossAmount} {selectedInvoice.currency}
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs flex flex-col justify-center items-center h-48">
              <FileBadge className="mb-2 text-slate-300" size={32} />
              <p>Select an invoice from the compliance table to inspect digital audit seals and Urzędowe Poświadczenie Odbioru receipts.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
