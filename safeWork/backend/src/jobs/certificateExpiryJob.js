const Employee = require('../models/Employee');
const { recalculateComplianceState } = require('../services/employeeService');
const { logAudit } = require('../middleware/auditLogger');

// ─────────────────────────────────────────────────────────────────────────────
// Certificate expiry job.
// ─────────────────────────────────────────────────────────────────────────────
// Runs once a day (00:01). It looks at every employee who is required to have a
// medical certificate and/or BHP training, checks each certificate's expiry
// date against today, and updates the status:
//
//   * expiry date already in the past       → EXPIRED
//   * expiry date within the next one month  → EXPIRING
//   * anything further away                  → left unchanged (as asked)
//
// It only touches a certificate when the required flag is true and there is an
// expiry date to compare against. When a status actually changes we ALSO refresh
// the employee's block / compliance state (using the same helper the upload flow
// uses), because an expired medical certificate must block clock-in — leaving
// the status changed but the block state stale would be a compliance hole.

// Return the date exactly one month from `from`. Using real calendar months
// (not "30 days") so "less than a month" means what a person would expect.
function oneMonthAfter(from) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// Decide the new status for a certificate from its expiry date.
// Returns 'EXPIRED', 'EXPIRING', or null when the status should NOT change.
function deriveStatus(expiryDate, now, monthAhead) {
  if (!expiryDate) return null; // no date → cannot judge, leave as-is
  const expiry = new Date(expiryDate);
  if (expiry < now) return 'EXPIRED';
  if (expiry < monthAhead) return 'EXPIRING';
  return null; // more than a month away → do not change
}

async function runCertificateExpiryJob() {
  const now = new Date();
  const monthAhead = oneMonthAfter(now);

  // Only pull employees who actually need one of the documents. This skips
  // everyone for whom the certificates do not matter.
  const employees = await Employee.find({
    $or: [{ requiresMedicalCertificate: true }, { requiresBHPTraining: true }],
  }).populate('userId', 'tenant email'); // tenant is needed for the audit log

  let checked = 0;
  let updated = 0;

  for (const emp of employees) {
    checked += 1;
    const changes = [];

    // ── Medical certificate ──────────────────────────────────────────────
    if (emp.requiresMedicalCertificate) {
      const newStatus = deriveStatus(emp.medicalCertificate?.expiryDate, now, monthAhead);
      const current = emp.medicalCertificate?.status;
      if (newStatus && newStatus !== current) {
        emp.medicalCertificate.status = newStatus;
        changes.push({ document: 'medicalCertificate', from: current, to: newStatus });
      }
    }

    // ── BHP training certificate ─────────────────────────────────────────
    if (emp.requiresBHPTraining) {
      const newStatus = deriveStatus(emp.bhpTraining?.expiryDate, now, monthAhead);
      const current = emp.bhpTraining?.status;
      if (newStatus && newStatus !== current) {
        emp.bhpTraining.status = newStatus;
        changes.push({ document: 'bhpTraining', from: current, to: newStatus });
      }
    }

    // Nothing changed for this employee → move on without saving.
    if (changes.length === 0) continue;

    // A status changed → keep block / compliance state in step with it, then save.
    recalculateComplianceState(emp);
    emp.updatedBy = 'SYSTEM';
    await emp.save();
    updated += 1;

    // Write an immutable audit record (tenant taken from the linked user).
    const tenantId = emp.userId?.tenant ? emp.userId.tenant.toString() : 'SYSTEM';
    await logAudit({
      tenantId,
      userId: 'SYSTEM',
      userEmail: 'system@safework',
      action: 'CERTIFICATE_STATUS_REFRESHED',
      resource: 'Employee',
      resourceId: emp._id.toString(),
      newValue: {
        changes,
        complianceStatus: emp.complianceStatus,
        isBlocked: emp.isBlocked,
        blockReason: emp.blockReason,
      },
    });
  }

  if (updated) {
    console.log(`[JOB] certificateExpiry — checked ${checked}, updated ${updated} employee(s)`);
  }
  return { checked, updated };
}

module.exports = { runCertificateExpiryJob, deriveStatus, oneMonthAfter };
