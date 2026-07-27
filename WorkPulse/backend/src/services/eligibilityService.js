const SafeWorkEmployee = require('../models/SafeWorkEmployee');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Eligibility service — "is this person allowed to clock in?"
// ─────────────────────────────────────────────────────────────────────────────
//
// WorkPulse does not decide this on its own. It reuses SafeWork's compliance
// decision: SafeWork already knows whether each employee's medical certificate
// and BHP (safety) training are valid, and marks the employee `isBlocked` when a
// required document is expired or missing.
//
// RULE:
//   * If SafeWork has a record for the user AND that record is NOT blocked
//     (and the employee is active) → the user may clock in.
//   * If the record is blocked → the user may NOT clock in; we return the
//     SafeWork block reason so the UI can show it and tell them to contact an
//     administrator.
//   * If SafeWork has NO record for the user → the user is not yet set up for
//     work, so they may NOT clock in and must contact an administrator.
//
// We look the employee up by their RegulaOne user id (SafeWork stores it on
// `userId`). We only read — WorkPulse never writes to SafeWork's data.

// Standard shape returned to callers so controllers/UI handle it consistently.
function decision(allowed, reason, employee) {
  return {
    allowed,
    reason: reason || null,
    // A trimmed view of the SafeWork record for display (never the whole doc).
    employee: employee
      ? {
          safeWorkId: employee._id,
          name: employee.name,
          department: employee.department,
          position: employee.position,
          site: employee.site,
          complianceStatus: employee.complianceStatus,
          isBlocked: Boolean(employee.isBlocked),
          blockReason: employee.blockReason || null,
        }
      : null,
  };
}

// Look up the SafeWork compliance record for a given RegulaOne user id.
// Returns the raw document (or null). Read-only.
async function findSafeWorkEmployee(userId) {
  if (!userId) return null;

  const userObjectId = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : null;

  // SafeWork stores the link on `userId` (ObjectId) and sometimes on `employeeId`
  // (the same id as a string). Match either so we always find the record.
  const query = userObjectId
    ? { $or: [{ userId: userObjectId }, { employeeId: userId.toString() }] }
    : { employeeId: userId.toString() };

  return SafeWorkEmployee.findOne(query).lean();
}

// The main check used by every clock-in attempt and by the frontend gate.
async function checkClockInEligibility(userId) {
  const employee = await findSafeWorkEmployee(userId);

  if (!employee) {
    return decision(
      false,
      'You are not set up for time tracking yet. Please contact your administrator.',
      null
    );
  }

  if (employee.isActive === false) {
    return decision(
      false,
      'Your employee record is inactive. Please contact your administrator.',
      employee
    );
  }

  if (employee.isBlocked) {
    // Reuse SafeWork's exact reason (e.g. "Medical certificate is expired").
    const reason = employee.blockReason
      ? `You cannot clock in: ${employee.blockReason}. Please contact your administrator.`
      : 'You cannot clock in because your safety/medical compliance is not up to date. Please contact your administrator.';
    return decision(false, reason, employee);
  }

  // Not blocked and active → allowed.
  return decision(true, null, employee);
}

module.exports = {
  checkClockInEligibility,
  findSafeWorkEmployee,
};
