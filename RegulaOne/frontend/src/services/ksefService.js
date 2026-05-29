import { api } from '../lib/api';

export const ksefService = {
  // GET /api/ksef/stats
  getStats: () =>
    api.get('/api/ksef/stats'),

  // GET /api/ksef/invoices
  getInvoices: () =>
    api.get('/api/ksef/invoices'),

  // GET /api/ksef/invoices/:id
  getInvoice: (id) =>
    api.get(`/api/ksef/invoices/${id}`),

  // POST /api/ksef/invoices  — creates a DRAFT invoice
  createInvoice: (data) =>
    api.post('/api/ksef/invoices', data),

  // POST /api/ksef/invoices/:id/submit  — submits DRAFT to KSeF
  submitToKSeF: (id) =>
    api.post(`/api/ksef/invoices/${id}/submit`),

  // GET /api/ksef/invoices/:id/xml  — returns raw FA(3) XML string
  downloadXml: (id) =>
    api.get(`/api/ksef/invoices/${id}/xml`),
};
