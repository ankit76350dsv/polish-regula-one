const settlementService = require('../services/settlementService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/settlement — settlement-period reconciliation for the whole tenant.
// Admin/HR view. Recalculates the current period first so the numbers are fresh,
// then returns one summary row per employee. ?onlyViolations=true shows only the
// employees who broke the 48h average (art. 131) or 150h/year (art. 151 §3) caps.
const getTenantSettlement = async (req, res, next) => {
  try {
    // Recalculate the current period so the report is never stale.
    await settlementService.reconcileTenant(req.tenantId, new Date());

    const onlyViolations = String(req.query.onlyViolations || '') === 'true';
    const summaries = await settlementService.getSummaries(req.tenantId, { onlyViolations });

    return sendSuccess(res, summaries, 'Settlement reconciliation retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/settlement/me — the logged-in employee's own reconciliation.
// Employees may see their own hours; this does not touch anyone else's data.
const getMySettlement = async (req, res, next) => {
  try {
    const result = await settlementService.reconcileEmployee(
      req.tenantId,
      req.user._id.toString(),
      new Date()
    );
    return sendSuccess(res, result, 'Your settlement reconciliation');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getTenantSettlement, getMySettlement };
