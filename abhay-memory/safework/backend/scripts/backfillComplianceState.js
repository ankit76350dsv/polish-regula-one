/**
 * One-time backfill: recalculate isBlocked / blockReason / complianceStatus
 * for EVERY existing SafeWork employee record.
 *
 * WHY THIS EXISTS
 * ---------------
 * The block/compliance state used to be recalculated only when a document was
 * uploaded. Records created or edited before that gap was fixed still hold the
 * stale schema-default values (isBlocked=false), so an employee who requires a
 * medical/BHP document but never uploaded one shows as "not blocked" on the
 * dashboard even though they are Non-Compliant.
 *
 * This script re-derives that state for all existing records using the SAME
 * rule as employeeService.recalculateComplianceState, so the fix applies to old
 * data without waiting for each record to be edited again.
 *
 * SAFE TO RE-RUN: it only recomputes derived fields; it never touches identity,
 * documents, or requirement flags. Running it twice produces the same result.
 *
 * USAGE (from the backend folder):
 *   node scripts/backfillComplianceState.js
 */

const mongoose = require('mongoose');
const config = require('../src/config/environment');
const SafeWorkEmployee = require('../src/models/Employee');

// Same blocking rule as employeeService.recalculateComplianceState:
// a REQUIRED document that is EXPIRED or MISSING blocks clock-in.
const BLOCKING = ['EXPIRED', 'MISSING'];

function recalculateComplianceState(profile) {
  const medStatus = profile.requiresMedicalCertificate
    ? (profile.medicalCertificate?.status || 'MISSING')
    : null;

  const bhpStatus = profile.requiresBHPTraining
    ? (profile.bhpTraining?.status || 'MISSING')
    : null;

  const reasons = [];
  if (medStatus && BLOCKING.includes(medStatus))
    reasons.push(`Medical certificate is ${medStatus.toLowerCase()}`);
  if (bhpStatus && BLOCKING.includes(bhpStatus))
    reasons.push(`BHP training certificate is ${bhpStatus.toLowerCase()}`);

  profile.isBlocked   = reasons.length > 0;
  profile.blockReason = reasons.length > 0 ? reasons.join('; ') : undefined;

  const requiredStatuses = [medStatus, bhpStatus].filter(Boolean);
  if (requiredStatuses.some((s) => BLOCKING.includes(s))) {
    profile.complianceStatus = 'NON_COMPLIANT';
  } else if (requiredStatuses.some((s) => s === 'EXPIRING')) {
    profile.complianceStatus = 'EXPIRING';
  } else {
    profile.complianceStatus = 'COMPLIANT';
  }
}

async function run() {
  await mongoose.connect(config.mongo.uri);
  console.log(`[backfill] connected to ${mongoose.connection.host}`);

  const employees = await SafeWorkEmployee.find({});
  console.log(`[backfill] found ${employees.length} employee record(s)`);

  let changed = 0;
  for (const emp of employees) {
    const before = {
      isBlocked: emp.isBlocked,
      complianceStatus: emp.complianceStatus,
    };

    recalculateComplianceState(emp);

    // Only write when something actually changed, to keep the run quiet and
    // avoid bumping updatedAt on records that were already correct.
    if (before.isBlocked !== emp.isBlocked || before.complianceStatus !== emp.complianceStatus) {
      await emp.save();
      changed += 1;
      console.log(
        `[backfill] ${emp.employeeId || emp._id}: ` +
        `isBlocked ${before.isBlocked} -> ${emp.isBlocked}, ` +
        `status ${before.complianceStatus} -> ${emp.complianceStatus}`
      );
    }
  }

  console.log(`[backfill] done — updated ${changed} of ${employees.length} record(s)`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[backfill] failed:', err);
  process.exit(1);
});
