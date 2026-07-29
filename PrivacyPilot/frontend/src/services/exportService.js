// Export recording — tells the backend that data is about to LEAVE the app.
//
// WHY: the audit trail could prove who CHANGED a record but not who took a COPY of one.
// Downloads, print views and clipboard copies all happened purely in the browser, so the
// whole Art. 30 register (and the audit trail itself) could walk out with no trace — in
// the very document that exists to demonstrate accountability (GDPR Art. 5(2)).
//
// HOW IT IS USED: call this FIRST and only produce the file if it succeeds. The rule is
// "no evidence, no copy" — see the export handlers in RegisterPage / AuditTrailPage /
// NoticesPage / BreachDetailPage.
//
// Everything identifying the person (user, role, company, IP, browser) is added by the
// server from the session cookie; we only say WHAT left, HOW, and HOW MUCH.
import { post } from './client';

export const exportService = {
  /**
   * Record one export. Resolves with the audit entry that was written (a receipt),
   * rejects if it could not be recorded — in which case the caller MUST NOT export.
   *
   * @param {object} p
   * @param {'register_controller'|'register_processor'|'audit_trail'|'privacy_notice'|'breach_report'} p.target
   * @param {'csv'|'json'|'markdown'|'word'|'print'|'clipboard'} p.format
   * @param {string} [p.entityId]      required for privacy_notice / breach_report
   * @param {number} [p.itemCount]     how many records the copy contained
   * @param {string} [p.filterSummary] the filters that were on screen, e.g. "department=hr"
   */
  record: ({ target, format, entityId, itemCount, filterSummary }) =>
    post('/api/privacypilot/exports', {
      target,
      format,
      entityId,
      itemCount,
      filterSummary,
    }),
};
