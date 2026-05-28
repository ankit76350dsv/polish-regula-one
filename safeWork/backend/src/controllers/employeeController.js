const { validationResult } = require('express-validator');
const employeeService = require('../services/employeeService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// Returns all tenant users merged with their EmployeeProfile compliance data.
// Guards against cross-tenant access before delegating to the service.
const getEmployees = async (req, res, next) => {
 try {
    const tenantId = req.params.tenantId || req.user?.tenant;

    const employees = await employeeService.getEmployeesByTenant(tenantId);

    return sendSuccess(
      res,
      {
        count: employees.length,
        employees,
      },
      'Employees fetched successfully'
    );
  } catch (err) {
    if (err.status) {
      return sendError(res, err.message, err.status);
    }

    next(err);
  }
};

// Creates or updates the compliance profile for a RegulaOne user.
// Identity fields (name, email) are sourced from RegulaOne and are not
// accepted in the request body — the service strips them before writing.
const upsertEmployeeProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'Validation failed', 400, errors.array());
    }

    const { employeeId } = req.params;

    const { profile, isNew } = await employeeService.upsertEmployeeProfile(
      employeeId,
      req.body,
      {
        tenantId: req.user.tenantId,
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    const statusCode = isNew ? 201 : 200;
    const message = isNew ? 'Employee profile created' : 'Employee profile updated';
    return sendSuccess(res, profile, message, statusCode);
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// Updates only compliance status fields (medical cert, BHP, blocking status).
const updateEmployeeCompliance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const updated = await employeeService.updateEmployeeCompliance(
      employeeId,
      req.user.tenantId,
      req.body,
      {
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );
    return sendSuccess(res, updated, 'Compliance updated');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getEmployees, upsertEmployeeProfile, updateEmployeeCompliance };
