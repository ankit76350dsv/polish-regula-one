const wasteEntryService = require('../services/wasteEntryService');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { logAudit } = require('../middleware/auditLogger');

const buildActor = (req) => ({
  tenantId: req.tenantId,
  userId: req.user._id.toString(),
  userEmail: req.user.email,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

// GET /api/waste-entries?year=
// Returns the current figures for each month of the year.
//
// companyId is no longer accepted or needed: the tenant owns exactly one company
// and the tenant is taken from the verified session, never from the client.
const getMonthlyEntries = async (req, res, next) => {
  try {
    const { year } = req.query;
    if (!year) {
      return sendError(res, 'year is required', 400);
    }

    const entries = await wasteEntryService.getMonthlyEntries(req.tenantId, year);
    return sendSuccess(res, { count: entries.length, entries }, 'Waste entries fetched');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/waste-entries/history?year=&month=
// Returns every version of one month so an auditor can see the full history.
const getEntryHistory = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return sendError(res, 'year and month are required', 400);
    }

    const history = await wasteEntryService.getEntryHistory(req.tenantId, year, month);

    // Viewing history is an auditable read.
    logAudit({
      ...buildActor(req),
      action: 'WASTE_ENTRY_HISTORY_VIEWED',
      resource: 'WasteEntry',
      newValue: { year, month },
    });

    return sendSuccess(res, { count: history.length, history }, 'History fetched');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// POST /api/waste-entries
// Records (or corrects) a month of waste data — always creates a new version.
const recordMonthlyEntry = async (req, res, next) => {
  try {
    const entry = await wasteEntryService.recordMonthlyEntry(req.body, buildActor(req));
    const message =
      entry.version > 1 ? 'Waste entry corrected (new version saved)' : 'Waste entry recorded';
    return sendSuccess(res, entry, message, 201);
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = {
  getMonthlyEntries,
  getEntryHistory,
  recordMonthlyEntry,
};
