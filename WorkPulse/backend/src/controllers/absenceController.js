const absenceService = require('../services/absenceService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

function actorFrom(req) {
  return {
    tenantId: req.tenantId,
    userId: req.user._id.toString(),
    userEmail: req.user.email,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

// POST /api/absences — create an absence request.
const createAbsence = async (req, res, next) => {
  try {
    // employeeName falls back to the caller's own identity for self-requests.
    const data = {
      ...req.body,
      employeeName: req.body.employeeName || req.user.name || req.user.email,
    };
    const absence = await absenceService.createAbsence(data, actorFrom(req));
    return sendSuccess(res, absence, 'Absence created', 201);
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// PATCH /api/absences/:id/decision — approve / reject / cancel (admin/HR).
const decideAbsence = async (req, res, next) => {
  try {
    const absence = await absenceService.decideAbsence(
      req.params.id,
      req.tenantId,
      { status: req.body.status },
      actorFrom(req)
    );
    return sendSuccess(res, absence, 'Absence decision saved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/absences/mine — the logged-in user's own absences.
const getMyAbsences = async (req, res, next) => {
  try {
    const list = await absenceService.getMyAbsences(req.user._id);
    return sendSuccess(res, list, 'Absences retrieved');
  } catch (err) {
    next(err);
  }
};

// GET /api/absences — every absence in the tenant (admin/HR).
const listAbsences = async (req, res, next) => {
  try {
    const list = await absenceService.listAbsences(req.tenantId, {
      status: req.query.status,
      type: req.query.type,
    });
    return sendSuccess(res, list, 'Absences retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { createAbsence, decideAbsence, getMyAbsences, listAbsences };
