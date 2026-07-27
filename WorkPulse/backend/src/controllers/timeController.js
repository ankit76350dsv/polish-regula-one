const timeEntryService = require('../services/timeEntryService');
const eligibilityService = require('../services/eligibilityService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// Small helper: gather request metadata every clock action needs (who / where).
function metaFrom(req) {
  return {
    source: req.body?.source || 'WEB',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}
function actorFrom(req) {
  return {
    tenantId: req.tenantId,
    userId: req.user._id.toString(),
    userEmail: req.user.email,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

// GET /api/time/eligibility — can the logged-in user clock in right now?
// The Clock screen calls this on load to show the gate ("contact administrator").
const getEligibility = async (req, res, next) => {
  try {
    const result = await eligibilityService.checkClockInEligibility(req.user._id);
    return sendSuccess(res, result, 'Eligibility checked');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/time/status — eligibility + the user's current open shift + live totals.
const getStatus = async (req, res, next) => {
  try {
    const status = await timeEntryService.getMyStatus(req.user, req.tenantId);
    return sendSuccess(res, status, 'Status retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const clockIn = async (req, res, next) => {
  try {
    const entry = await timeEntryService.clockIn(req.user, req.tenantId, metaFrom(req));
    return sendSuccess(res, entry, 'Clocked in', 201);
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status, err.code ? [{ code: err.code }] : null);
    next(err);
  }
};

const clockOut = async (req, res, next) => {
  try {
    const entry = await timeEntryService.clockOut(req.user, req.tenantId, metaFrom(req));
    return sendSuccess(res, entry, 'Clocked out');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const startBreak = async (req, res, next) => {
  try {
    const entry = await timeEntryService.startBreak(req.user, req.tenantId, metaFrom(req));
    return sendSuccess(res, entry, 'Break started');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const endBreak = async (req, res, next) => {
  try {
    const entry = await timeEntryService.endBreak(req.user, req.tenantId, metaFrom(req));
    return sendSuccess(res, entry, 'Break ended');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/time/my-entries — the logged-in user's own history.
const getMyEntries = async (req, res, next) => {
  try {
    const { from, to, page, limit } = req.query;
    const result = await timeEntryService.getMyEntries(req.user._id, { from, to, page, limit });
    return sendSuccess(res, result, 'Entries retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/time/entries — admin/HR list across the whole tenant.
const listEntries = async (req, res, next) => {
  try {
    const { from, to, status, department, page, limit } = req.query;
    const result = await timeEntryService.listEntries(req.tenantId, {
      from,
      to,
      status,
      department,
      page,
      limit,
    });
    return sendSuccess(res, result, 'Entries retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const getEntryById = async (req, res, next) => {
  try {
    const entry = await timeEntryService.getEntryById(req.params.entryId, req.tenantId);
    return sendSuccess(res, entry, 'Entry retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// PATCH /api/time/entries/:entryId/correct — HR fixes a wrong clock/break.
const correctEntry = async (req, res, next) => {
  try {
    const entry = await timeEntryService.correctEntry(
      req.params.entryId,
      req.tenantId,
      req.body,
      actorFrom(req)
    );
    return sendSuccess(res, entry, 'Entry corrected');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// PATCH /api/time/entries/:entryId/overtime — approve or reject overtime.
const decideOvertime = async (req, res, next) => {
  try {
    const entry = await timeEntryService.decideOvertime(
      req.params.entryId,
      req.tenantId,
      { decision: req.body.decision, reason: req.body.reason },
      actorFrom(req)
    );
    return sendSuccess(res, entry, 'Overtime decision saved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = {
  getEligibility,
  getStatus,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getMyEntries,
  listEntries,
  getEntryById,
  correctEntry,
  decideOvertime,
};
