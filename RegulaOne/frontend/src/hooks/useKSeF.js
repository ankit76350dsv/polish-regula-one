import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ksefService } from '../services/ksefService';

const KEYS = {
  stats:    ['ksef', 'stats'],
  invoices: ['ksef', 'invoices'],
  invoice:  (id) => ['ksef', 'invoices', id],
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export function useKSeFStats() {
  return useQuery({
    queryKey: KEYS.stats,
    queryFn:  ksefService.getStats,
    staleTime: 30_000,
  });
}

// ── Invoice list ──────────────────────────────────────────────────────────────

export function useKSeFInvoices() {
  return useQuery({
    queryKey: KEYS.invoices,
    queryFn:  ksefService.getInvoices,
    staleTime: 15_000,
  });
}

// ── Single invoice ────────────────────────────────────────────────────────────

export function useKSeFInvoice(id) {
  return useQuery({
    queryKey: KEYS.invoice(id),
    queryFn:  () => ksefService.getInvoice(id),
    enabled:  !!id,
  });
}

// ── Create invoice ────────────────────────────────────────────────────────────

export function useCreateInvoice(onSuccess) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ksefService.createInvoice,

    onSuccess: (newInvoice) => {
      queryClient.invalidateQueries({ queryKey: KEYS.invoices });
      queryClient.invalidateQueries({ queryKey: KEYS.stats });
      toast.success(`Invoice ${newInvoice.invoiceNumber} created as DRAFT`);
      onSuccess?.();
    },

    onError: (err) => {
      toast.error(err.message || 'Failed to create invoice');
    },
  });
}

// ── Submit to KSeF ────────────────────────────────────────────────────────────

export function useSubmitToKSeF() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ksefService.submitToKSeF,

    onSuccess: (updated) => {
      // Update both the list and the individual invoice cache
      queryClient.invalidateQueries({ queryKey: KEYS.invoices });
      queryClient.invalidateQueries({ queryKey: KEYS.stats });
      queryClient.setQueryData(KEYS.invoice(updated.id), updated);

      toast.success(
        updated.status === 'ACCEPTED'
          ? `Invoice ${updated.invoiceNumber} accepted by KSeF — ID: ${updated.ksefId}`
          : `Invoice ${updated.invoiceNumber} submitted to KSeF`
      );
    },

    onError: (err) => {
      toast.error(err.message || 'KSeF submission failed');
    },
  });
}

// ── Download XML ──────────────────────────────────────────────────────────────

export function useDownloadXml() {
  return useMutation({
    mutationFn: ksefService.downloadXml,

    onSuccess: (xmlContent, invoiceId) => {
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `invoice-${invoiceId}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('FA(3) XML downloaded');
    },

    onError: (err) => {
      toast.error(err.message || 'Failed to download XML');
    },
  });
}
