import { useState } from 'react';
import { FileWarning, Plus, Trash2, Loader2, X } from 'lucide-react';
import { correctInvoice } from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';

// ── Correction invoice (faktura korygująca) ───────────────────────────────────
// SIMPLE EXPLANATION:
// An invoice already sent to KSeF cannot be edited — it is permanent. If it was wrong, we issue
// a NEW invoice that CORRECTS it (faktura korygująca, type "KOR"). This modal opens from a SENT
// invoice, pre-fills its lines so the user can change them to the corrected values, asks for the
// reason, and creates the correction as a DRAFT linked to the original. The user then submits
// that draft like any other invoice.

// How much VAT each rate adds (used to recompute line amounts as the user edits).
const VAT_MULTIPLIER = { '23': 0.23, '8': 0.08, '5': 0.05, '0': 0, exempt: 0, reverse_charge: 0 };

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export default function CorrectionModal({ original, tenant, onClose, onCreated, onAddNotification }) {
  const { language, t } = useLanguage();
  
  // Start the corrected lines as a copy of the original invoice's lines.
  const [items, setItems] = useState(
    (original.items ?? []).map((it, idx) => ({
      id: it.id || `corr-${idx}`,
      productName: it.productName || '',
      unit: it.unit || 'szt.',
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      vatRate: String(it.vatRate ?? '23'),
    })),
  );
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [correctionType, setCorrectionType] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Recompute one line's net/vat/gross from quantity × price × rate.
  const computeAmounts = (it) => {
    const net = round2(it.quantity * it.unitPrice);
    const vat = round2(net * (VAT_MULTIPLIER[it.vatRate] ?? 0));
    return { netAmount: net, vatAmount: vat, grossAmount: round2(net + vat) };
  };

  const updateItem = (id, field, value) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));

  const addItem = () =>
    setItems((prev) => [...prev, { id: `corr-${Date.now()}`, productName: '', unit: 'szt.', quantity: 1, unitPrice: 0, vatRate: '23' }]);

  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  // Totals across all corrected lines.
  const totals = items.reduce(
    (acc, it) => {
      const a = computeAmounts(it);
      return { net: acc.net + a.netAmount, vat: acc.vat + a.vatAmount, gross: acc.gross + a.grossAmount };
    },
    { net: 0, vat: 0, gross: 0 },
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!invoiceNumber.trim())   { setError(language === 'pl' ? 'Podaj numer faktury korygującej (np. FV/2026/06/0007).' : 'Provide correction invoice number (e.g. FV/2026/06/0007).'); return; }
    if (!reason.trim())          { setError(language === 'pl' ? 'Podaj powód korekty (wymagany przez KSeF).' : 'Provide correction reason (required by KSeF).'); return; }
    if (items.length === 0)      { setError(language === 'pl' ? 'Korekta musi mieć co najmniej jedną pozycję.' : 'Correction must have at least one line item.'); return; }

    // Build the corrected invoice payload. Seller/buyer are copied from the original (they do not
    // change in a correction); only the lines/amounts and the correction reason differ.
    const payload = {
      invoiceNumber: invoiceNumber.trim(),
      issueDate,
      dueDate: original.dueDate || undefined,
      sellerName: original.sellerName, sellerNip: original.sellerNIP,
      sellerAddress: original.sellerAddress, sellerPostalCode: original.sellerPostalCode, sellerCity: original.sellerCity,
      buyerName: original.buyerName, buyerNip: original.buyerNIP,
      buyerAddress: original.buyerAddress, buyerPostalCode: original.buyerPostalCode, buyerCity: original.buyerCity,
      currency: original.currency,
      paymentMethod: original.paymentMethod,
      bankAccount: original.bankAccount,
      notes: original.notes,
      totalNet: round2(totals.net),
      totalVat: round2(totals.vat),
      totalGross: round2(totals.gross),
      items: items.map((it) => ({ ...it, ...computeAmounts(it) })),
    };

    setBusy(true);
    try {
      const created = await correctInvoice(
        original.id, payload, reason.trim(), correctionType === '' ? undefined : Number(correctionType),
      );
      onAddNotification?.(
        language === 'pl' ? 'Korekta utworzona' : 'Correction Created',
        language === 'pl' 
          ? `Utworzono fakturę korygującą ${created.invoiceNumber} (do ${original.invoiceNumber}). Wyślij ją do KSeF z repozytorium.` 
          : `Created correction invoice ${created.invoiceNumber} (for ${original.invoiceNumber}). Submit it to KSeF from the repository.`,
        'success',
      );
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      const msg = err.message || (language === 'pl' ? 'Nie udało się utworzyć korekty.' : 'Failed to create correction.');
      setError(msg);
      onAddNotification?.(language === 'pl' ? 'Błąd korekty' : 'Correction Error', msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const money = (v) => Number(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !busy && onClose?.()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 text-amber-700 rounded-lg p-1.5"><FileWarning size={16} /></div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">{language === 'pl' ? 'Wystaw korektę (faktura korygująca)' : 'Issue correction (correction invoice)'}</h3>
              <p className="text-[11px] text-slate-500">{language === 'pl' ? 'Koryguje fakturę' : 'Corrects invoice'} <strong className="font-mono">{original.invoiceNumber}</strong> · KSeF: <span className="font-mono">{original.ksefId || '—'}</span></p>
            </div>
          </div>
          <button onClick={() => !busy && onClose?.()} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="font-semibold text-slate-600 space-y-1 block">
              <span>{language === 'pl' ? 'Numer korekty' : 'Correction number'}</span>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="FV/2026/06/0007"
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm" />
            </label>
            <label className="font-semibold text-slate-600 space-y-1 block">
              <span>{language === 'pl' ? 'Data wystawienia' : 'Date of issue'}</span>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm" />
            </label>
            <label className="font-semibold text-slate-600 space-y-1 block">
              <span>{language === 'pl' ? 'Typ korekty (opcjonalnie)' : 'Correction type (optional)'}</span>
              <select value={correctionType} onChange={(e) => setCorrectionType(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm cursor-pointer">
                <option value="">—</option>
                <option value="1">{language === 'pl' ? '1 — korekta pozycji' : '1 — line item correction'}</option>
                <option value="2">{language === 'pl' ? '2 — korekta podstawy/stawki' : '2 — tax base/rate correction'}</option>
                <option value="3">{language === 'pl' ? '3 — inna' : '3 — other'}</option>
              </select>
            </label>
          </div>

          <label className="font-semibold text-slate-600 space-y-1 block">
            <span>{language === 'pl' ? 'Powód korekty (wymagany)' : 'Correction reason (required)'}</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={language === 'pl' ? 'np. Błędna ilość w pozycji 1' : 'e.g. Incorrect quantity in item 1'}
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm" />
          </label>

          {/* Corrected line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">{language === 'pl' ? 'Pozycje po korekcie' : 'Items after correction'}</span>
              <button type="button" onClick={addItem}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                <Plus size={13} /> {language === 'pl' ? 'Dodaj pozycję' : 'Add Item'}
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[9px]">
                  <tr>
                    <th className="text-left font-bold px-2 py-2">{language === 'pl' ? 'Nazwa' : 'Name'}</th>
                    <th className="text-right font-bold px-2 py-2">{language === 'pl' ? 'Ilość' : 'Qty'}</th>
                    <th className="text-right font-bold px-2 py-2">{language === 'pl' ? 'Cena netto' : 'Net Price'}</th>
                    <th className="text-center font-bold px-2 py-2">VAT</th>
                    <th className="text-right font-bold px-2 py-2">{language === 'pl' ? 'Brutto' : 'Gross'}</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => {
                    const a = computeAmounts(it);
                    return (
                      <tr key={it.id}>
                        <td className="px-2 py-1.5">
                          <input value={it.productName} onChange={(e) => updateItem(it.id, 'productName', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" value={it.quantity}
                            onChange={(e) => updateItem(it.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-16 text-right border border-slate-200 rounded-lg px-2 py-1" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" value={it.unitPrice}
                            onChange={(e) => updateItem(it.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right border border-slate-200 rounded-lg px-2 py-1" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <select value={it.vatRate} onChange={(e) => updateItem(it.id, 'vatRate', e.target.value)}
                            className="border border-slate-200 rounded-lg px-1 py-1 cursor-pointer">
                            <option value="23">23%</option>
                            <option value="8">8%</option>
                            <option value="5">5%</option>
                            <option value="0">0%</option>
                            <option value="exempt">zw</option>
                            <option value="reverse_charge">oo</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-700">{money(a.grossAmount)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <button type="button" onClick={() => removeItem(it.id)}
                            className="text-slate-300 hover:text-red-600 cursor-pointer"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-6 text-[11px] font-mono text-slate-600 pt-1">
              <span>{language === 'pl' ? 'Netto:' : 'Net:'} <strong>{money(totals.net)}</strong></span>
              <span>VAT: <strong>{money(totals.vat)}</strong></span>
              <span className="text-slate-900">{language === 'pl' ? 'Brutto:' : 'Gross:'} <strong className="text-red-650">{money(totals.gross)} {original.currency}</strong></span>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => !busy && onClose?.()} disabled={busy}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50 cursor-pointer">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition disabled:opacity-60 cursor-pointer">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <FileWarning size={14} />} {language === 'pl' ? 'Utworz korektę (DRAFT)' : 'Create Correction (DRAFT)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
