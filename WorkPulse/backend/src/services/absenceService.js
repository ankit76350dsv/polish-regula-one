const mongoose = require('mongoose');
const Absence = require('../models/Absence');
const { logAudit } = require('../middleware/auditLogger');

// ─────────────────────────────────────────────────────────────────────────────
// Absence service — leave, sickness and other non-working days.
// ─────────────────────────────────────────────────────────────────────────────

// Absence types that are normally UNPAID. Everything else defaults to paid.
const UNPAID_TYPES = new Set(['UNPAID_LEAVE']);

// Count working days between two dates (inclusive), skipping Saturdays/Sundays.
// NOTE: this does not yet subtract Polish public holidays — a future version can
// load the official holiday calendar. Weekends are excluded because the standard
// Polish working week is Monday–Friday.
function countWorkingDays(start, end) {
  const from = new Date(start);
  from.setHours(0, 0, 0, 0);
  const to = new Date(end);
  to.setHours(0, 0, 0, 0);

  if (to < from) return 0;

  let days = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// Create an absence request. Employees create their own (PENDING); admins may
// create one already APPROVED on someone's behalf.
async function createAbsence(data, actor) {
  const { userId, employeeId, employeeName, type, startDate, endDate, reason, documentPath, status } = data;

  if (!type || !startDate || !endDate) {
    throw { status: 400, message: 'type, startDate and endDate are required' };
  }
  if (new Date(endDate) < new Date(startDate)) {
    throw { status: 400, message: 'endDate cannot be before startDate' };
  }

  const workingDays = countWorkingDays(startDate, endDate);

  const absence = await Absence.create({
    tenantId: actor.tenantId,
    userId: userId || actor.userId,
    employeeId: employeeId || actor.userId,
    employeeName,
    type,
    startDate,
    endDate,
    workingDays,
    paid: !UNPAID_TYPES.has(type),
    status: status || 'PENDING',
    reason,
    documentPath,
    createdBy: actor.userId,
    updatedBy: actor.userId,
  });

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'ABSENCE_CREATED',
    resource: 'Absence',
    resourceId: absence._id.toString(),
    newValue: { type, startDate, endDate, workingDays, status: absence.status },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return absence;
}

// Approve / reject / cancel an absence.
async function decideAbsence(absenceId, tenantId, { status }, actor) {
  if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
    throw { status: 400, message: 'status must be APPROVED, REJECTED or CANCELLED' };
  }
  const absence = await Absence.findOne({ _id: absenceId, tenantId, deletedAt: null });
  if (!absence) throw { status: 404, message: 'Absence not found' };

  const oldValue = { status: absence.status };
  absence.status = status;
  if (status === 'APPROVED') {
    absence.approvedBy = actor.userId;
    absence.approvedAt = new Date();
  }
  absence.updatedBy = actor.userId;
  await absence.save();

  await logAudit({
    tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'ABSENCE_DECISION',
    resource: 'Absence',
    resourceId: absence._id.toString(),
    oldValue,
    newValue: { status },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return absence;
}

// List the logged-in user's own absences.
async function getMyAbsences(userId) {
  return Absence.find({ userId, deletedAt: null }).sort({ startDate: -1 }).lean();
}

// List every absence in the tenant (admin/HR), newest first, with optional filters.
async function listAbsences(tenantId, { status, type } = {}) {
  const query = { tenantId, deletedAt: null };
  if (status && status !== 'All') query.status = status;
  if (type && type !== 'All') query.type = type;
  return Absence.find(query).sort({ startDate: -1 }).limit(200).lean();
}

module.exports = {
  countWorkingDays,
  createAbsence,
  decideAbsence,
  getMyAbsences,
  listAbsences,
};
