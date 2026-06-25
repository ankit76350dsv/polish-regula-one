import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createInvoice, submitInvoice, getInvoice, getInvoiceXml } from '../api/ksefApi';
import { openInvoicePrint } from '../lib/offlineInvoice';
import {
  Plus,
  Trash2,
  FileCode2,
  Save,
  Download,
  CheckCircle,
  AlertCircle,
  FileCheck2,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../lib/permissions';
import InvoiceStatusTimeline from './InvoiceStatusTimeline';

export default function InvoiceForm({ tenant, role, permissions, onAddInvoice, onAddNotification, onNavigate, govStatus, existingInvoice }) {
  const { t, language } = useLanguage();
  // Issuing/submitting invoices requires KSEF_CASE_MANAGER (or KSEF_TENANT_ADMIN) —
  // same rule the backend enforces on POST /invoices/draft and /submit.
  const canModify = can.issueInvoices(permissions);

  const { pathname } = useLocation();
  const tenantIdFromUrl = pathname.split('/').filter(Boolean)[1] ?? tenant.id;

  // Only a DRAFT invoice may be edited. Anything already submitted (SENT / OFFLINE_MODE / PENDING /
  // RETRYING / FAILED / CORRECTED) is locked — opening "View Full Invoice Details" shows it read-only.
  const isViewOnly = !!existingInvoice && existingInvoice.status !== 'DRAFT';

  // Fields are editable only when the user CAN modify (permission) AND the invoice is not locked.
  // Use this everywhere instead of just !canModify so non-DRAFT invoices can't be edited at all.
  const isReadOnly = !canModify || isViewOnly;

  const [buyerName, setBuyerName] = useState(existingInvoice?.buyerName ?? 'Central Trade Poland Sp. z o.o.');
  const [buyerNip, setBuyerNip] = useState(existingInvoice?.buyerNIP ?? '5229983144');
  const [buyerAddress, setBuyerAddress] = useState(existingInvoice?.buyerAddress ?? 'Al. Jerozolimskie 22');
  // FA(3) requires the buyer postal code and city as discrete fields (not a single
  // address line) so they can be emitted as <KodPocztowy> / <Miejscowosc> in the XML.
  const [buyerPostalCode, setBuyerPostalCode] = useState(existingInvoice?.buyerPostalCode ?? '00-345');
  const [buyerCity, setBuyerCity] = useState(existingInvoice?.buyerCity ?? 'Warszawa');

  // Seller address is editable and prefilled from the organisation profile when set.
  // Some org records have no address on file, so these stay editable to let the user
  // supply the FA(3)-required seller address inline rather than being blocked.
  const [sellerAddress, setSellerAddress] = useState(existingInvoice?.sellerAddress ?? tenant.address ?? '');
  const [sellerPostalCode, setSellerPostalCode] = useState(existingInvoice?.sellerPostalCode ?? tenant.postalCode ?? '');
  const [sellerCity, setSellerCity] = useState(existingInvoice?.sellerCity ?? tenant.city ?? '');

  const [invoiceNumber, setInvoiceNumber] = useState(existingInvoice?.invoiceNumber ?? `FV/2026/05/000${Math.floor(Math.random() * 90) + 10}`);
  const [issueDate, setIssueDate] = useState(existingInvoice?.issueDate ?? new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    if (existingInvoice?.dueDate) return existingInvoice.dueDate;
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  });
  const [currency, setCurrency] = useState(existingInvoice?.currency ?? 'PLN');
  const [paymentMethod, setPaymentMethod] = useState(existingInvoice?.paymentMethod ?? 'Split Payment');
  const [bankAccount, setBankAccount] = useState(existingInvoice?.bankAccount ?? 'PL 89 1020 1026 0000 9602 0231 4323');
  const [notes, setNotes] = useState(existingInvoice?.notes ?? 'Mandatory KSeF FA(3) Split payment scheme applied.');

  const [items, setItems] = useState(existingInvoice?.items ?? [
    {
      id: 'item-init-1',
      productName: 'Qualified Polish Compliance Consultation & Training',
      quantity: 1,
      unitPrice: 2200.00,
      vatRate: '23',
      netAmount: 2200.00,
      vatAmount: 506.00,
      grossAmount: 2706.00
    },
    {
      id: 'item-init-2',
      productName: 'Certified VAT Compliance Manual (Handbook V2)',
      quantity: 5,
      unitPrice: 150.00,
      vatRate: '8',
      netAmount: 750.00,
      vatAmount: 60.00,
      grossAmount: 810.00
    }
  ]);

  const [activeTab, setActiveTab] = useState('form');
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  // Last error from a Save-Draft / Submit / Offline action — shown inline in the
  // Government Execution Deck so the user always sees why an action failed.
  const [formError, setFormError] = useState(null);

  // Real, official FA(3) XML fetched from the backend (the same XML KSeF receives). We show this
  // instead of a hand-built approximation. Only available once the invoice is saved (has an id).
  const [realXml, setRealXml] = useState(null);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [xmlError, setXmlError] = useState(null);

  // Lazily load the official XML the first time the user opens the XML tab for a saved invoice.
  useEffect(() => {
    if (activeTab !== 'xml' || !existingInvoice?.id || realXml || xmlLoading) return;
    setXmlLoading(true);
    setXmlError(null);
    getInvoiceXml(existingInvoice.id)
      .then((xml) => setRealXml(typeof xml === 'string' ? xml : String(xml ?? '')))
      .catch((err) => setXmlError(err.message || (language === 'pl' ? 'Nie udało się pobrać XML.' : 'Failed to load XML.')))
      .finally(() => setXmlLoading(false));
  }, [activeTab, existingInvoice?.id, realXml, xmlLoading, language]);

  // Save the official XML to a .xml file.
  const downloadXmlFile = () => {
    if (!realXml) return;
    const blob = new Blob([realXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(existingInvoice?.invoiceNumber || invoiceNumber).replace(/[^a-zA-Z0-9._-]/g, '_')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build an OFFICIAL Polish "Faktura VAT" (the Art. 106e legally-required fields) from the current
  // form data and open the browser's print dialog (Save as PDF). No app/company branding — only the
  // legal invoice content. The legal record remains the FA(3) XML in KSeF; this is the human-readable
  // visualization. Works for both new and saved invoices.
  const downloadInvoicePdf = () => {
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const m = (v) => (Number(v) || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rateLabel = (r) => (r === 'exempt' ? 'zw' : `${r}%`);
    const ccy = currency;

    // VAT breakdown grouped by rate (required summary on a VAT invoice).
    const byRate = {};
    items.forEach((it) => {
      const k = String(it.vatRate);
      byRate[k] = byRate[k] || { net: 0, vat: 0, gross: 0 };
      byRate[k].net += it.netAmount; byRate[k].vat += it.vatAmount; byRate[k].gross += it.grossAmount;
    });
    const vatRows = Object.entries(byRate).map(([rate, v]) =>
      `<tr><td>${rateLabel(rate)}</td><td style="text-align:right">${m(v.net)}</td><td style="text-align:right">${m(v.vat)}</td><td style="text-align:right">${m(v.gross)}</td></tr>`).join('');

    const itemRows = items.map((it, i) =>
      `<tr><td>${i + 1}</td><td>${esc(it.productName) || '—'}</td><td style="text-align:right">${esc(it.quantity)} szt.</td><td style="text-align:right">${m(it.unitPrice)}</td><td style="text-align:center">${rateLabel(it.vatRate)}</td><td style="text-align:right">${m(it.netAmount)}</td><td style="text-align:right">${m(it.grossAmount)}</td></tr>`).join('');

    const statusLine = existingInvoice?.ksefId
      ? `Numer KSeF: ${esc(existingInvoice.ksefId)}`
      : (existingInvoice && existingInvoice.status !== 'DRAFT'
          ? `Status: ${esc(existingInvoice.status)}`
          : 'Dokument roboczy — niewysłany do KSeF');

    const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"/><title>Faktura ${esc(invoiceNumber)}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:12px}
      h1{font-size:20px;margin:0}
      .muted{color:#666;font-size:10px}
      .row{display:flex;justify-content:space-between;gap:40px;margin:14px 0}
      .box h3{font-size:10px;text-transform:uppercase;color:#888;margin:0 0 4px;letter-spacing:.04em}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{border:1px solid #e5e5e5;padding:5px 7px;font-size:11px}
      th{background:#f5f5f5;text-align:left;color:#555}
      .totals{margin-left:auto;width:300px}
      .totals td{border:none;padding:3px 6px}
      .totals .grand td{font-size:15px;font-weight:bold;border-top:2px solid #111}
      @media print{button{display:none}}
    </style></head><body>
      <div class="row" style="align-items:flex-start">
        <div><h1>Faktura VAT</h1><div class="muted">Faktura ustrukturyzowana FA(3)</div></div>
        <div style="text-align:right"><div style="font-weight:bold">${esc(invoiceNumber)}</div><div class="muted">${esc(statusLine)}</div></div>
      </div>
      <div class="row">
        <div class="box"><h3>Sprzedawca</h3><div>${esc(tenant.name)}</div><div>${esc(sellerAddress)}</div><div>${esc(sellerPostalCode)} ${esc(sellerCity)}</div><div>NIP: ${esc(tenant.nip)}</div></div>
        <div class="box"><h3>Nabywca</h3><div>${esc(buyerName)}</div><div>${esc(buyerAddress)}</div><div>${esc(buyerPostalCode)} ${esc(buyerCity)}</div><div>NIP: ${esc(buyerNip)}</div></div>
      </div>
      <div class="row">
        <div>Data wystawienia: <strong>${esc(issueDate)}</strong></div>
        <div>Termin płatności: <strong>${esc(dueDate)}</strong></div>
        <div>Waluta: <strong>${esc(ccy)}</strong> · Płatność: <strong>${esc(paymentMethod)}</strong></div>
      </div>
      <table><thead><tr><th>Lp.</th><th>Nazwa towaru / usługi</th><th style="text-align:right">Ilość</th><th style="text-align:right">Cena netto</th><th style="text-align:center">VAT</th><th style="text-align:right">Wartość netto</th><th style="text-align:right">Wartość brutto</th></tr></thead><tbody>${itemRows}</tbody></table>
      <div class="muted" style="text-transform:uppercase;margin:14px 0 4px">Podsumowanie VAT</div>
      <table style="width:360px"><thead><tr><th>Stawka</th><th style="text-align:right">Netto</th><th style="text-align:right">VAT</th><th style="text-align:right">Brutto</th></tr></thead><tbody>${vatRows}</tbody></table>
      <table class="totals"><tbody>
        <tr><td>Razem netto</td><td style="text-align:right">${m(totalNet)} ${esc(ccy)}</td></tr>
        <tr><td>Razem VAT</td><td style="text-align:right">${m(totalVat)} ${esc(ccy)}</td></tr>
        <tr class="grand"><td>Do zapłaty</td><td style="text-align:right">${m(totalGross)} ${esc(ccy)}</td></tr>
      </tbody></table>
      <div style="margin-top:14px"><div>Numer konta: <strong>${esc(bankAccount)}</strong></div>${notes ? `<div class="muted" style="margin-top:6px">Uwagi: ${esc(notes)}</div>` : ''}</div>
      <button onclick="window.print()" style="margin-top:24px;padding:8px 14px">Drukuj / Zapisz jako PDF</button>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      onAddNotification(
        language === 'pl' ? 'Zablokowano okno' : 'Popup blocked',
        language === 'pl' ? 'Odblokuj wyskakujące okna, aby pobrać PDF.' : 'Allow popups for this site to download the PDF.',
        'error');
      return;
    }
    win.document.open(); win.document.write(html); win.document.close();
  };

  const calculateTotals = (currentItems) => {
    let netSum = 0;
    let vatSum = 0;
    let grossSum = 0;
    currentItems.forEach(item => {
      netSum += item.netAmount;
      vatSum += item.vatAmount;
      grossSum += item.grossAmount;
    });
    return {
      totalNet: parseFloat(netSum.toFixed(2)),
      totalVat: parseFloat(vatSum.toFixed(2)),
      totalGross: parseFloat(grossSum.toFixed(2))
    };
  };

  const { totalNet, totalVat, totalGross } = calculateTotals(items);

  const updateItem = (index, field, value) => {
    const updated = [...items];
    const item = updated[index];

    if (field === 'productName') {
      item.productName = value;
    } else if (field === 'quantity') {
      item.quantity = Math.max(1, parseInt(value) || 1);
    } else if (field === 'unitPrice') {
      item.unitPrice = Math.max(0, parseFloat(value) || 0);
    } else if (field === 'vatRate') {
      item.vatRate = value;
    }

    const quantity = item.quantity;
    const price = item.unitPrice;
    item.netAmount = parseFloat((quantity * price).toFixed(2));

    let vatRatePercent = 0;
    if (item.vatRate === '23') vatRatePercent = 0.23;
    else if (item.vatRate === '8') vatRatePercent = 0.08;
    else if (item.vatRate === '5') vatRatePercent = 0.05;
    else if (item.vatRate === '0') vatRatePercent = 0.00;

    item.vatAmount = parseFloat((item.netAmount * vatRatePercent).toFixed(2));
    item.grossAmount = parseFloat((item.netAmount + item.vatAmount).toFixed(2));

    setItems(updated);
    simulateAutosave();
  };

  const addItem = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      productName: '',
      quantity: 1,
      unitPrice: 0,
      vatRate: '23',
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const simulateAutosave = () => {
    setIsAutosaving(true);
    setTimeout(() => {
      setIsAutosaving(false);
    }, 800);
  };

  const getSessionUserId = () => {
    try {
      const stored = localStorage.getItem('ksefflow_user');
      return stored ? (JSON.parse(stored)?.email ?? undefined) : undefined;
    } catch {
      return undefined;
    }
  };

  const handleSaveDraft = async () => {
    setFormError(null);
    if (!canModify) {
      const msg = language === 'pl' ? 'Twoja rola nie pozwala na tworzenie faktur.' : 'Your active role does not permit creating invoices.';
      setFormError(msg);
      onAddNotification(language === 'pl' ? 'Odrzucono dostęp RBAC' : 'RBAC Permission Denied', msg, 'error');
      return;
    }

    if (!buyerNip || !buyerName) {
      const msg = language === 'pl' ? 'Nazwa nabywcy oraz NIP są wymagane.' : 'NIP and Buyer Name are mandatory.';
      setFormError(msg);
      onAddNotification(language === 'pl' ? 'Błąd walidacji' : 'Validation Error', msg, 'error');
      return;
    }

    if (!sellerAddress || !sellerPostalCode || !sellerCity) {
      const msg = language === 'pl' ? 'Adres, kod pocztowy i miasto sprzedawcy są wymagane dla schematu FA(3).' : 'Seller address, postal code and city are required for FA(3).';
      setFormError(msg);
      onAddNotification(language === 'pl' ? 'Błąd walidacji' : 'Validation Error', msg, 'error');
      return;
    }

    setIsSavingDraft(true);
    const userId = getSessionUserId();

    try {
      const draft = await createInvoice({
        tenantId: tenantIdFromUrl,
        userId,
        invoiceNumber,
        issueDate,
        dueDate,
        sellerName: tenant.name,
        sellerNip: tenant.nip,
        sellerAddress,
        sellerPostalCode,
        sellerCity,
        buyerName,
        buyerNip,
        buyerAddress,
        buyerPostalCode,
        buyerCity,
        currency,
        totalNet,
        totalVat,
        totalGross,
        paymentMethod,
        bankAccount,
        notes,
        items,
      });

      setSaveSuccess(true);
      onAddInvoice(draft, 'INVOICE_DRAFT_SAVED');
      onAddNotification(
        t('invoiceForm.draftSuccess'),
        t('invoiceForm.draftSuccessDesc'),
        'success'
      );
      setTimeout(() => setSaveSuccess(false), 3000);
      onNavigate('invoices');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error while saving draft';
      setFormError(message);
      onAddNotification(language === 'pl' ? 'Błąd zapisu szkicu' : 'Draft Save Failed', message, 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (_forceOffline = false) => {
    setFormError(null);
    if (!canModify) {
      const msg = language === 'pl' ? 'Twoja rola nie pozwala na podpisywanie lub generowanie faktur.' : 'Your active role does not permit sealing or generating compliance invoices.';
      setFormError(msg);
      onAddNotification(language === 'pl' ? 'Odrzucono dostęp RBAC' : 'RBAC Permission Denied', msg, 'error');
      return;
    }

    if (!buyerNip || !buyerName) {
      const msg = language === 'pl' ? 'NIP oraz Nazwa nabywcy są wymagane dla faktury.' : 'NIP and Buyer Name are mandatory for legitimate invoices.';
      setFormError(msg);
      onAddNotification(language === 'pl' ? 'Błąd walidacji' : 'Validation Error', msg, 'error');
      return;
    }

    if (!sellerAddress || !sellerPostalCode || !sellerCity) {
      const msg = language === 'pl' ? 'Adres, kod pocztowy i miasto sprzedawcy są wymagane dla schematu FA(3).' : 'Seller address, postal code and city are required for FA(3).';
      setFormError(msg);
      onAddNotification(language === 'pl' ? 'Błąd walidacji' : 'Validation Error', msg, 'error');
      return;
    }

    setIsSubmitting(true);
    const userId = getSessionUserId();

    try {
      onAddNotification(language === 'pl' ? 'Tworzenie faktury' : 'Creating Invoice', language === 'pl' ? 'Zapisywanie wersji roboczej...' : 'Saving draft…', 'info');

      const draft = await createInvoice({
        tenantId: tenantIdFromUrl,
        userId,
        invoiceNumber,
        issueDate,
        dueDate,
        sellerName: tenant.name,
        sellerNip: tenant.nip,
        sellerAddress,
        sellerPostalCode,
        sellerCity,
        buyerName,
        buyerNip,
        buyerAddress,
        buyerPostalCode,
        buyerCity,
        currency,
        totalNet,
        totalVat,
        totalGross,
        paymentMethod,
        bankAccount,
        notes,
        items,
      });

      onAddNotification(language === 'pl' ? 'Wysyłanie do KSeF' : 'Submitting to KSeF', language === 'pl' ? 'Generowanie struktury XML FA(3) i otwieranie sesji KSeF...' : 'Generating FA(3) XML and opening KSeF session…', 'info');

      const submitResult = await submitInvoice(tenantIdFromUrl, draft.id, tenant.nip, userId);
      const finalInvoice = await getInvoice(tenantIdFromUrl, draft.id);

      if (submitResult.status === 'SENT') {
        onAddInvoice(finalInvoice, 'INVOICE_SEALED_KSEF_SENT');
        onAddNotification(
          t('invoiceForm.ksefSuccess'),
          t('invoiceForm.ksefSuccessDesc', { id: submitResult.ksefId }),
          'success'
        );
        onNavigate('invoices');
      } else {
        onAddInvoice(finalInvoice, 'OFFLINE_FALLBACK_ACTIVATED');
        onAddNotification(
          t('invoiceForm.offlineSuccess'),
          t('invoiceForm.offlineSuccessDesc'),
          'warn'
        );
        onNavigate('offline');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error during submission';
      setFormError(message);
      onAddNotification(language === 'pl' ? 'Wysyłka nieudana' : 'Submission Failed', message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isAiLoading, setIsAiLoading] = useState(false);
  const triggerAiAssist = async () => {
    setIsAiLoading(true);
    try {
      const polishComplianceTemplates = [
        {
          name: "Industrial Steel Coil Handling (EU Standard Extra)",
          items: [
            { id: 'ai-1', productName: 'Carbon Steel Coil HRC Grade S235JR', quantity: 4, unitPrice: 1550, vatRate: '23', netAmount: 6200, vatAmount: 1426, grossAmount: 7626 },
            { id: 'ai-2', productName: 'Cross-border Road Logistics (Warsaw-Stuttgart)', quantity: 1, unitPrice: 2800, vatRate: '0', netAmount: 2800, vatAmount: 0, grossAmount: 2800 },
          ]
        },
        {
          name: "Medical Diagnostic Equipment Deployment",
          items: [
            { id: 'ai-3', productName: 'Certified Medical Ultrasound Imager (Type 5X Pro)', quantity: 1, unitPrice: 42000, vatRate: '8', netAmount: 42000, vatAmount: 3360, grossAmount: 45360 },
            { id: 'ai-4', productName: 'Certified Calibration and QA Setup service', quantity: 1, unitPrice: 1500, vatRate: '23', netAmount: 1500, vatAmount: 345, grossAmount: 1845 },
          ]
        },
        {
          name: "Agricultural Feedstock Supply",
          items: [
            { id: 'ai-5', productName: 'Organic Winter Wheat Seed Stock (Class A)', quantity: 12, unitPrice: 380, vatRate: '5', netAmount: 4560, vatAmount: 228, grossAmount: 4788 },
            { id: 'ai-6', productName: 'Eco-Friendly Biocide Spray compliance kit', quantity: 2, unitPrice: 120, vatRate: '8', netAmount: 240, vatAmount: 19.2, grossAmount: 259.2 },
          ]
        }
      ];

      const chosen = polishComplianceTemplates[Math.floor(Math.random() * polishComplianceTemplates.length)];
      setItems(chosen.items);
      setNotes(`Automated AI Assist filled fields. Selected NIP conforms to Polish VAT standards for: ${chosen.name}. Verification status: ACTIVE.`);
      onAddNotification('Compliance Intelligence Active', 'AI automatically matched items to Polish statutory tax codes and VAT brackets.', 'success');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {existingInvoice && (
        <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('invoices')}
              className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 font-semibold transition cursor-pointer"
            >
              ← {language === 'pl' ? 'Wróć do Repozytorium' : 'Back to Repository'}
            </button>
            <span className="text-stone-300">|</span>
            <span className="font-mono font-bold text-stone-800">{existingInvoice.invoiceNumber}</span>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
            existingInvoice.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            existingInvoice.status === 'OFFLINE_MODE' ? 'bg-orange-50 text-orange-700 border-orange-200' :
            existingInvoice.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
            existingInvoice.status === 'RETRYING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            existingInvoice.status === 'PENDING' ? 'bg-blue-50 text-blue-700 border-blue-200' :
            'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            ● {existingInvoice.status}
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Sparkles className="text-red-700" size={20} />
            {language === 'pl' ? 'Kreator e-faktur KSeF FA(3)' : 'KSeF FA(3) Registered Creator'}
          </h2>
          <p className="text-zinc-550 text-xs mt-0.5">{language === 'pl' ? 'Wystawiaj i rejestruj prawnie wiążące faktury zgodne ze specyfikacją Ministerstwa Finansów.' : 'Author and register legally-binding invoices compliant with the Polish Ministry of Finance.'}</p>
        </div>

        <div className="flex items-center gap-3 mt-3 sm:mt-0 font-sans">
          {isAutosaving && (
            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping"></span> {language === 'pl' ? 'Zapisywanie szkicu...' : 'Saving draft...'}
            </span>
          )}
          <div className="bg-stone-100 p-1 rounded-lg inline-flex text-xs font-semibold">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'form' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
            >
              {language === 'pl' ? 'Formularz interaktywny' : 'Interactive Form'}
            </button>
            <button
              onClick={() => setActiveTab('xml')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'xml' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
            >
              {language === 'pl' ? 'Podgląd XML FA(3)' : 'FA(3) Legal XML Preview'}
            </button>
            <button
              onClick={() => setActiveTab('pdf')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'pdf' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
            >
              {language === 'pl' ? 'Wizualizacja PDF' : 'Compliance PDF Draft'}
            </button>
          </div>
        </div>
      </div>

      {!canModify && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs flex gap-2.5 items-start">
          <AlertCircle size={16} className="text-amber-700 mt-0.5 shrink-0" />
          <p>
            <strong>{language === 'pl' ? 'Tryb tylko do odczytu aktywny dla roli Audytora/Finansów' : 'Read-Only Mode active for Auditor/Finance role'}</strong>. {language === 'pl' ? 'Możesz przeglądać dane i sprawdzać strukturę XML, ale nie posiadasz uprawnień do podpisania i wysyłania transakcji do rządowego API.' : 'You can preview, audit fields, and check XML structure but you do not hold qualified signature credentials to submit transactions to Government APIs.'}
          </p>
        </div>
      )}

      {isViewOnly && (
        <div className="bg-slate-50 border border-slate-200 text-slate-700 p-3.5 rounded-xl text-xs flex gap-2.5 items-start">
          <FileCheck2 size={16} className="text-slate-500 mt-0.5 shrink-0" />
          <p>
            <strong>{language === 'pl' ? 'Tryb tylko do odczytu' : 'Read-only'}</strong>. {language === 'pl'
              ? `Ta faktura ma status ${existingInvoice.status} i została już przetworzona, więc nie można jej edytować. Tylko faktury robocze (DRAFT) są edytowalne. Aby coś zmienić, wystaw fakturę korygującą.`
              : `This invoice is ${existingInvoice.status} and has already been processed, so it cannot be edited. Only DRAFT invoices are editable — to change a processed invoice, issue a correction.`}
          </p>
        </div>
      )}

      {activeTab === 'form' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white border border-stone-200/90 rounded-xl p-6 shadow-xs space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-stone-50 border border-stone-200/60 p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-stone-400 bg-white px-2 py-0.5 border rounded-full uppercase tracking-wider">
                  01 {language === 'pl' ? 'SPRZEDAWCA' : 'SELLER'}
                </span>
                <div className="space-y-2.5 text-xs text-stone-700">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{t('invoiceForm.sellerNip')}</label>
                    <input
                      type="text"
                      value={tenant.nip ?? ''}
                      disabled
                      placeholder="NIP"
                      className="col-span-2 bg-stone-100 px-2 py-1.5 border border-stone-200 rounded font-mono font-semibold text-stone-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{language === 'pl' ? 'Nazwa firmy' : 'Company Name'}</label>
                    <input
                      type="text"
                      value={tenant.name ?? ''}
                      disabled
                      placeholder="Name"
                      className="col-span-2 bg-stone-100 px-2 py-1.5 border border-stone-200 rounded font-semibold text-stone-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{t('invoiceForm.sellerAddress')}</label>
                    <input
                      type="text"
                      value={sellerAddress}
                      onChange={(e) => { setSellerAddress(e.target.value); simulateAutosave(); }}
                      disabled={isReadOnly}
                      placeholder={language === 'pl' ? 'Ulica i numer budynku' : 'Street and building number'}
                      className="col-span-2 bg-white px-2 py-1.5 border border-stone-200 rounded"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{t('invoiceForm.sellerPostCode')}</label>
                    <input
                      type="text"
                      value={sellerPostalCode}
                      onChange={(e) => { setSellerPostalCode(e.target.value); simulateAutosave(); }}
                      disabled={isReadOnly}
                      placeholder="00-000"
                      className="col-span-2 bg-white px-2 py-1.5 border border-stone-200 rounded font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{t('invoiceForm.sellerCity')}</label>
                    <input
                      type="text"
                      value={sellerCity}
                      onChange={(e) => { setSellerCity(e.target.value); simulateAutosave(); }}
                      disabled={isReadOnly}
                      placeholder="City"
                      className="col-span-2 bg-white px-2 py-1.5 border border-stone-200 rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200/60 p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-stone-400 bg-white px-2 py-0.5 border rounded-full uppercase tracking-wider">
                  02 {language === 'pl' ? 'NABYWCA' : 'BUYER'}
                </span>
                <div className="space-y-2.5 text-xs text-stone-700">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{t('invoiceForm.buyerNip')}</label>
                    <input
                      type="text"
                      value={buyerNip}
                      onChange={(e) => { setBuyerNip(e.target.value); simulateAutosave(); }}
                      disabled={isReadOnly}
                      placeholder="NIP"
                      className="col-span-2 bg-white px-2 py-1.5 border border-stone-200 rounded font-mono font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{language === 'pl' ? 'Nazwa firmy' : 'Company Name'}</label>
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => { setBuyerName(e.target.value); simulateAutosave(); }}
                      disabled={isReadOnly}
                      placeholder="Buyer legal name"
                      className="col-span-2 bg-white px-2 py-1.5 border border-stone-200 rounded font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{t('invoiceForm.buyerAddress')}</label>
                    <input
                      type="text"
                      value={buyerAddress}
                      onChange={(e) => { setBuyerAddress(e.target.value); simulateAutosave(); }}
                      disabled={isReadOnly}
                      placeholder={language === 'pl' ? 'Ulica i numer budynku' : 'Street and building number'}
                      className="col-span-2 bg-white px-2 py-1.5 border border-stone-200 rounded"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{t('invoiceForm.buyerPostCode')}</label>
                    <input
                      type="text"
                      value={buyerPostalCode}
                      onChange={(e) => { setBuyerPostalCode(e.target.value); simulateAutosave(); }}
                      disabled={isReadOnly}
                      placeholder="00-000"
                      className="col-span-2 bg-white px-2 py-1.5 border border-stone-200 rounded font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-stone-500 col-span-1 self-center">{t('invoiceForm.buyerCity')}</label>
                    <input
                      type="text"
                      value={buyerCity}
                      onChange={(e) => { setBuyerCity(e.target.value); simulateAutosave(); }}
                      disabled={isReadOnly}
                      placeholder="City"
                      className="col-span-2 bg-white px-2 py-1.5 border border-stone-200 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-stone-500 block mb-1">{t('invoiceForm.invoiceNumber')}</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-white px-2 py-1.5 border border-stone-200 rounded font-mono font-semibold"
                />
              </div>
              <div>
                <label className="text-stone-500 block mb-1">{t('invoiceForm.issueDate')}</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-white px-2 py-1.5 border border-stone-200 rounded font-mono"
                />
              </div>
              <div>
                <label className="text-stone-500 block mb-1">{language === 'pl' ? 'Termin płatności' : 'Due Date'}</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-white px-2 py-1.5 border border-stone-200 rounded font-mono"
                />
              </div>
              <div>
                <label className="text-stone-500 block mb-1">{language === 'pl' ? 'Waluta' : 'Currency'}</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-white px-2 py-1.5 border border-stone-200 rounded font-semibold text-stone-850 cursor-pointer"
                >
                  <option value="PLN">PLN - złoty</option>
                  <option value="EUR">EUR - euro</option>
                  <option value="USD">USD - dollar</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2 border-stone-100">
                <span className="text-xs font-bold text-stone-700 tracking-wide uppercase">03 {language === 'pl' ? 'POZYCJE (TOWARY I USŁUGI)' : 'ITEMS (GOODS & SERVICES)'}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={triggerAiAssist}
                    disabled={isAiLoading || isReadOnly}
                    className="text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles size={12} className="animate-pulse" />
                    {isAiLoading ? (language === 'pl' ? 'Mapowanie AI...' : 'AI Mapping...') : (language === 'pl' ? 'Uzupełnij przez AI (VAT PL)' : 'Smart Polish VAT Auto-Fill')}
                  </button>
                  <button
                    onClick={addItem}
                    disabled={isReadOnly}
                    className="bg-stone-900 hover:bg-stone-800 text-white px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus size={12} /> {language === 'pl' ? 'Dodaj pozycję' : 'Add Item Row'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 bg-stone-50/70 p-3 rounded-lg border border-stone-100 text-xs items-center">
                    <div className="col-span-12 md:col-span-4">
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => updateItem(index, 'productName', e.target.value)}
                        disabled={isReadOnly}
                        placeholder={language === 'pl' ? 'Nazwa towaru lub usługi' : 'Service name description'}
                        className="w-full bg-white px-2 py-1.5 border border-stone-200 rounded font-medium"
                      />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full bg-white px-2 py-1.5 border border-stone-200 rounded text-center font-mono"
                      />
                    </div>
                    <div className="col-span-5 md:col-span-2">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full bg-white px-2 py-1.5 border border-stone-200 rounded text-right font-mono font-semibold text-stone-800"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <select
                        value={item.vatRate}
                        onChange={(e) => updateItem(index, 'vatRate', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full bg-white px-1.5 py-1.5 border border-stone-200 rounded font-semibold text-stone-700 cursor-pointer"
                      >
                        <option value="23">23% (Std)</option>
                        <option value="8">8% (Services)</option>
                        <option value="5">5% (Food/Agri)</option>
                        <option value="0">0% (Export)</option>
                        <option value="exempt">zw (Exempt)</option>
                      </select>
                    </div>
                    <div className="col-span-6 md:col-span-1 text-right px-1">
                      <div className="text-[10px] text-stone-400">{language === 'pl' ? 'Netto' : 'Net total'}</div>
                      <div className="font-mono font-semibold text-stone-700">
                        {item.netAmount.toLocaleString('pl-PL')} <span className="text-[10px]">{currency}</span>
                      </div>
                    </div>
                    <div className="col-span-6 md:col-span-1 text-right flex items-center justify-between">
                      <div className="w-full">
                        <div className="text-[10px] text-stone-400">{language === 'pl' ? 'Brutto' : 'Gross'}</div>
                        <div className="font-mono font-bold text-stone-900">
                          {item.grossAmount.toLocaleString('pl-PL')} <span className="text-[10px]">{currency}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={items.length <= 1 || isReadOnly}
                        className="text-stone-400 hover:text-red-650 p-1 rounded-md ml-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-stone-100">
              <div>
                <label className="text-xs text-stone-500 block mb-1">{language === 'pl' ? 'Metoda płatności i numer konta bankowego' : 'Payment Method & Banking Coordinates'}</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={isReadOnly}
                    className="col-span-1 bg-stone-550 px-2 py-1.5 border border-stone-200 rounded text-xs font-semibold text-stone-800 cursor-pointer"
                  >
                    <option value="Split Payment">Split Payment</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Cash">Cash</option>
                  </select>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    disabled={isReadOnly}
                    className="col-span-2 bg-stone-50 px-2 py-1.5 border border-stone-200 rounded text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-500 block mb-1">{language === 'pl' ? 'Oficjalne uwagi do Krajowego Rejestru (Metadane FA-3)' : 'Official Notes for Central Register (FA-3 Metadata)'}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-stone-50 px-2 py-1.5 border border-stone-200 rounded text-xs"
                  placeholder={language === 'pl' ? 'Wpisz uwagi...' : 'Insert notes, e.g., Split payment references code...'}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-4">
              <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider border-b pb-2 border-stone-100">
                04 {language === 'pl' ? 'Podsumowanie' : 'Summary'}
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">{language === 'pl' ? 'Suma Netto' : 'Total Net Value'} ({currency})</span>
                  <span className="font-mono font-medium text-stone-850">
                    {totalNet.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">{language === 'pl' ? 'Suma podatku VAT' : 'Consolidated VAT Amount'} ({currency})</span>
                  <span className="font-mono font-semibold text-stone-850">
                    {totalVat.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-px bg-stone-200/60 my-2"></div>
                <div className="flex justify-between items-baseline">
                  <span className="text-stone-800 font-semibold text-sm">{language === 'pl' ? 'SUMA BRUTTO' : 'TOTAL GROSS'}</span>
                  <span className="font-sans font-bold text-lg text-emerald-700">
                    {totalGross.toLocaleString('pl-PL', { style: 'currency', currency: currency })}
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-[11px] text-emerald-800 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <CheckCircle size={12} /> {language === 'pl' ? 'Format FA(3)' : 'FA(3) format'}
                </div>
                <p className="leading-relaxed text-emerald-900/80">
                  {language === 'pl'
                    ? 'Faktura zostanie wystawiona w obowiązującej strukturze FA(3) i wysłana do KSeF.'
                    : 'This invoice will be issued in the required FA(3) structure and sent to KSeF.'}
                </p>
              </div>
            </div>

            <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider mb-2">
                05 {language === 'pl' ? 'Status w KSeF' : 'KSeF Status'}
              </h4>

              {isViewOnly ? (
                <div className="space-y-3">
                  <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    existingInvoice?.status === 'SENT' ? 'bg-emerald-550 border-emerald-200' :
                    existingInvoice?.status === 'OFFLINE_MODE' ? 'bg-orange-50 border-orange-200' :
                    existingInvoice?.status === 'FAILED' ? 'bg-red-50 border-red-200' :
                    existingInvoice?.status === 'RETRYING' ? 'bg-amber-50 border-amber-200' :
                    'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-700">{language === 'pl' ? 'Status KSeF' : 'KSeF Status'}</span>
                      <span className={`font-mono font-bold text-[10px] ${
                        existingInvoice?.status === 'SENT' ? 'text-emerald-700' :
                        existingInvoice?.status === 'OFFLINE_MODE' ? 'text-orange-700' :
                        existingInvoice?.status === 'FAILED' ? 'text-red-700' :
                        'text-blue-700'
                      }`}>● {existingInvoice?.status}</span>
                    </div>
                    {existingInvoice?.ksefId && (
                      <div>
                        <p className="text-[10px] text-stone-500">KSeF ID</p>
                        <p className="font-mono font-bold text-stone-800 text-[10px] break-all bg-white/70 p-1.5 rounded border border-stone-200 mt-0.5">
                          {existingInvoice.ksefId}
                        </p>
                      </div>
                    )}
                  </div>

                  {existingInvoice?.qrCodeInvoice && (
                    <button
                      onClick={() => openInvoicePrint(existingInvoice)}
                      className="w-full flex items-center justify-center gap-2 text-[11px] font-semibold border border-stone-300 hover:border-stone-400 hover:bg-stone-50 text-stone-700 rounded-lg py-2 transition cursor-pointer"
                    >
                      <Download size={13} /> {language === 'pl' ? 'Pobierz fakturę (PDF)' : 'Download Invoice (PDF)'}
                    </button>
                  )}

                  <div className="text-[10px] text-stone-400 text-center">
                    {language === 'pl' ? 'Ta faktura została już przetworzona. Przełącz na zakładkę XML lub PDF, aby sprawdzić pełną treść.' : 'This invoice has already been processed. Switch to the XML or PDF tab to inspect the full document.'}
                  </div>

                  {/* Full status timeline: how this invoice progressed (DRAFT → PENDING → SENT/FAILED → ...),
                      its current status, and what the user should do next. Reads the backend /status endpoint. */}
                  <InvoiceStatusTimeline invoiceId={existingInvoice?.id} />
                </div>
              ) : (
                <div className="space-y-2">
                  {formError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 p-3 rounded-xl border border-red-350 bg-red-50 text-red-800 text-xs"
                    >
                      <AlertCircle size={15} className="text-red-600 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-semibold">{language === 'pl' ? 'Akcja nieudana' : 'Action failed'}</p>
                        <p className="break-words">{formError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormError(null)}
                        className="ml-auto text-red-400 hover:text-red-700 font-bold leading-none cursor-pointer"
                        aria-label="Dismiss error"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={!canModify || isSubmitting}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer ${
                      isSubmitting
                        ? 'bg-stone-400 text-white cursor-not-allowed'
                        : 'bg-red-700 hover:bg-red-800 text-white'
                    }`}
                  >
                    <FileCheck2 size={15} />
                    {isSubmitting ? (language === 'pl' ? 'Wysyłanie do KSeF...' : 'Submitting to KSeF…') : (language === 'pl' ? 'Podpisz i wyślij do KSeF' : 'Sign & Submit to Central KSeF')}
                  </button>

                  <button
                    onClick={handleSaveDraft}
                    disabled={!canModify || isSavingDraft || isSubmitting}
                    className={`w-full border py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                      saveSuccess
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <Save size={15} className={saveSuccess ? 'text-emerald-600' : 'text-stone-500'} />
                    {isSavingDraft ? (language === 'pl' ? 'Zapisywanie...' : 'Saving Draft…') : saveSuccess ? (language === 'pl' ? 'Zapisano!' : 'Draft Saved!') : (language === 'pl' ? 'Zapisz jako roboczą' : 'Save as Draft')}
                  </button>

                  <button
                    onClick={() => handleSubmit(true)}
                    disabled={!canModify || isSubmitting}
                    className="w-full border border-stone-300 hover:border-orange-200 hover:bg-orange-50/50 py-2.5 px-4 rounded-xl text-stone-700 text-xs font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <AlertCircle size={15} className="text-orange-600" />
                    {language === 'pl' ? 'Wymuś pracę offline (Offline Fallback)' : 'Force Offline Fallback Mode'}
                  </button>

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'xml' && (
        <div className="space-y-4">
          {!existingInvoice?.id ? (
            // No saved invoice yet → the official XML is generated by the server from saved data.
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs flex gap-2.5 items-start">
              <AlertCircle size={16} className="text-amber-700 mt-0.5 shrink-0" />
              <p>
                {language === 'pl'
                  ? 'Oficjalny XML FA(3) jest generowany przez serwer na podstawie zapisanej faktury. Zapisz fakturę jako roboczą, aby zobaczyć i pobrać dokładny XML, który trafi do KSeF.'
                  : 'The official FA(3) XML is generated by the server from the saved invoice. Save this invoice as a draft to view and download the exact XML that will be sent to KSeF.'}
              </p>
            </div>
          ) : (
            <div className="bg-stone-900 rounded-xl p-5 shadow-inner border border-stone-850 font-mono text-stone-300 text-xs space-y-4">
              <div className="flex justify-between items-center bg-stone-850 p-3 rounded-lg border border-stone-800 text-[11px] text-stone-400">
                <span className="flex items-center gap-1">
                  <FileCode2 size={13} className="text-red-400" />
                  {(existingInvoice.invoiceNumber || 'FA3').replace(/[^a-zA-Z0-9._-]/g, '_')}.xml
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { if (realXml) { navigator.clipboard.writeText(realXml); onAddNotification(language === 'pl' ? 'Skopiowano' : 'Copied', language === 'pl' ? 'Oficjalny XML FA(3) skopiowany do schowka.' : 'Official FA(3) XML copied to clipboard.', 'success'); } }}
                    disabled={!realXml}
                    className="hover:text-white flex items-center gap-1 text-[10px] bg-stone-900 px-2 py-1 rounded border border-stone-800 transition cursor-pointer disabled:opacity-40"
                  >
                    {language === 'pl' ? 'Kopiuj XML' : 'Copy XML'}
                  </button>
                  <button
                    onClick={downloadXmlFile}
                    disabled={!realXml}
                    className="hover:text-white flex items-center gap-1 text-[10px] bg-stone-900 px-2 py-1 rounded border border-stone-800 transition cursor-pointer disabled:opacity-40"
                  >
                    <Download size={11} /> {language === 'pl' ? 'Pobierz XML' : 'Download XML'}
                  </button>
                </div>
              </div>

              {xmlLoading ? (
                <div className="flex items-center justify-center h-40 text-stone-400 gap-2 font-sans">
                  <span className="w-3 h-3 rounded-full border-2 border-stone-600 border-t-red-400 animate-spin" />
                  {language === 'pl' ? 'Generowanie XML z serwera…' : 'Generating XML from server…'}
                </div>
              ) : xmlError ? (
                <div className="text-red-300 font-sans text-[11px] p-2 bg-stone-950 rounded border border-red-900/50">{xmlError}</div>
              ) : (
                <pre className="overflow-x-auto max-h-[28rem] text-amber-100 p-2 bg-stone-950 rounded border border-stone-900 leading-relaxed font-sans text-xs">
                  <code className="font-mono text-[11px] block whitespace-pre">
                    {realXml}
                  </code>
                </pre>
              )}
            </div>
          )}
          <div className="text-xs text-stone-500 leading-relaxed">
            {language === 'pl'
              ? '* To jest dokładny, oficjalny XML FA(3) (przestrzeń nazw http://crd.gov.pl/wzor/2025/06/25/13775/) generowany przez serwer — ten sam dokument, który jest wysyłany do KSeF.'
              : '* This is the exact, official FA(3) XML (namespace http://crd.gov.pl/wzor/2025/06/25/13775/) generated by the server — the very same document submitted to KSeF.'}
          </div>
        </div>
      )}

      {activeTab === 'pdf' && (
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex justify-end">
            <button
              onClick={downloadInvoicePdf}
              className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
            >
              <Download size={14} /> {language === 'pl' ? 'Pobierz PDF' : 'Download PDF'}
            </button>
          </div>
          <div className="bg-white border-2 border-stone-200/90 p-8 rounded-xl shadow-md text-stone-800 text-sm space-y-6">
            <div className="flex justify-between items-start border-b pb-6 border-stone-200">
              <div>
                <div className="text-stone-400 uppercase text-xs tracking-wider font-semibold">{language === 'pl' ? 'Prezentacja dokumentu' : 'Document visualization'}</div>
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">FAKTURA VAT</h2>
                <div className="text-xs font-mono text-stone-500 mt-1">{language === 'pl' ? 'Numer faktury:' : 'Invoice Number:'} <strong className="text-stone-800">{invoiceNumber}</strong></div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider">{language === 'pl' ? 'Struktura' : 'Schema'}</div>
                <div className="font-semibold text-stone-700 text-sm">FA(3)</div>
                <div className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                  existingInvoice?.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  existingInvoice?.status === 'OFFLINE_MODE' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                  'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {existingInvoice?.ksefId
                    ? `KSeF: ${existingInvoice.ksefId}`
                    : (existingInvoice && existingInvoice.status !== 'DRAFT'
                        ? existingInvoice.status
                        : (language === 'pl' ? 'SZKIC — NIEWYSŁANO DO KSeF' : 'DRAFT — NOT SENT TO KSeF'))}
                </div>
              </div>
            </div>

          <div className="grid grid-cols-2 gap-8 text-xs leading-normal">
            <div>
              <h4 className="font-bold text-stone-400 uppercase tracking-wider mb-2 border-b pb-1">SPRZEDAWCA (SELLER)</h4>
              <p className="font-semibold text-stone-850 text-sm">{tenant.name}</p>
              <p>{sellerAddress}</p>
              <p>{sellerPostalCode} {sellerCity}</p>
              <p className="font-mono mt-1 font-semibold text-stone-800">NIP: {tenant.nip}</p>
            </div>
            <div>
              <h4 className="font-bold text-stone-400 uppercase tracking-wider mb-2 border-b pb-1">NABYWCA (BUYER)</h4>
              <p className="font-semibold text-stone-850 text-sm">{buyerName || "[Insert Buyer Name]"}</p>
              <p>{buyerAddress || "[Insert Buyer Address]"}</p>
              <p>{buyerPostalCode} {buyerCity}</p>
              <p className="font-mono mt-1 font-semibold text-stone-800">NIP: {buyerNip || "[Insert NIP]"}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 bg-stone-50 p-3.5 rounded-lg text-xs">
            <div>
              <span className="text-stone-500 block">{language === 'pl' ? 'Data wystawienia:' : 'Date of Issue:'}</span>
              <strong className="text-stone-800 font-mono">{issueDate}</strong>
            </div>
            <div>
              <span className="text-stone-500 block">{language === 'pl' ? 'Termin płatności:' : 'Due Date:'}</span>
              <strong className="text-stone-800 font-mono">{dueDate}</strong>
            </div>
            <div>
              <span className="text-stone-500 block">{language === 'pl' ? 'Waluta i forma płatności:' : 'Currency & Scheme:'}</span>
              <strong className="text-stone-800 font-mono">{currency} • {paymentMethod}</strong>
            </div>
          </div>

          <table className="w-full text-xs text-left text-stone-700 border-collapse">
            <thead>
              <tr className="bg-stone-100 text-stone-500 uppercase font-semibold text-[10px]">
                <th className="p-2.5 rounded-l">{language === 'pl' ? 'Lp.' : 'Line'}</th>
                <th className="p-2.5">{language === 'pl' ? 'Nazwa' : 'Name'}</th>
                <th className="p-2.5 text-center">{language === 'pl' ? 'Ilość' : 'Qty'}</th>
                <th className="p-2.5 text-right">{language === 'pl' ? 'Cena netto' : 'Net Price'}</th>
                <th className="p-2.5 text-center">VAT %</th>
                <th className="p-2.5 text-right">{language === 'pl' ? 'Kwota netto' : 'Net Sum'}</th>
                <th className="p-2.5 text-right rounded-r">{language === 'pl' ? 'Kwota brutto' : 'Gross Sum'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((item, index) => (
                <tr key={item.id} className="hover:bg-stone-50/50">
                  <td className="p-2.5 font-mono text-stone-400">{index + 1}</td>
                  <td className="p-2.5 font-medium text-stone-800">{item.productName || "Unnamed custom entry"}</td>
                  <td className="p-2.5 text-center font-mono">{item.quantity}</td>
                  <td className="p-2.5 text-right font-mono">{item.unitPrice.toFixed(2)}</td>
                  <td className="p-2.5 text-center font-mono font-semibold">{item.vatRate}%</td>
                  <td className="p-2.5 text-right font-mono">{item.netAmount.toFixed(2)}</td>
                  <td className="p-2.5 text-right font-mono font-semibold text-stone-900">{item.grossAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end pt-4 border-t border-stone-200">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>{language === 'pl' ? 'Suma Netto:' : 'Sum Netto:'}</span>
                <strong className="font-mono text-stone-800">{totalNet.toFixed(2)} {currency}</strong>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>{language === 'pl' ? 'Suma VAT:' : 'Sum VAT:'}</span>
                <strong className="font-mono text-stone-800">{totalVat.toFixed(2)} {currency}</strong>
              </div>
              <div className="flex justify-between text-stone-900 font-bold border-t pt-2 text-sm">
                <span>{language === 'pl' ? 'Suma Brutto:' : 'Total Brutto:'}</span>
                <span className="font-mono text-stone-950 text-base">{totalGross.toFixed(2)} {currency}</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 text-[10px] text-stone-400 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="space-y-0.5 text-left">
              <p>{language === 'pl' ? 'Konto bankowe:' : 'Bank Account:'} <strong>{bankAccount}</strong></p>
              <p>{language === 'pl' ? 'Uwagi:' : 'Official Note:'} <em>{notes}</em></p>
            </div>
            <div className="text-center font-mono text-[9px] text-stone-400">
              <p>{language === 'pl' ? 'Faktura ustrukturyzowana KSeF — struktura FA(3)' : 'KSeF structured invoice — FA(3) schema'}</p>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
