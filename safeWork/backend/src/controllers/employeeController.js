const { validationResult } = require('express-validator');
const employeeService = require('../services/employeeService');
const { generateUploadUrl } = require('../utils/s3');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { logAudit } = require('../middleware/auditLogger');

// The tenant id is resolved once by the auth middleware (from the logged-in
// user's RegulaOne session) and exposed as req.tenantId. Controllers ALWAYS use
// req.tenantId and never accept a tenant id from the client (query/body/params).

// Returns all tenant users merged with their EmployeeProfile compliance data.
// Guards against cross-tenant access before delegating to the service.
//
// NEW: Accepts optional query params for server-side filtering:
//   ?search=<text>           — case-insensitive match on name, email, position, department, site
//   ?department=<value>      — exact department match
//   ?site=<value>            — exact site match
//   ?complianceStatus=<key>  — one of: compliant | expiring | warning | blocked
const getEmployees = async (req, res, next) => {
  try {
    // Tenant comes from the authenticated session, never from the request.
    const tenantId = req.tenantId;

    // Extract filter + pagination params from the query string.
    // Strip "All" values — the frontend sends "All" when no filter is selected.
    const { search, department, site, complianceStatus, page, limit } = req.query;

    const filters = {
      search:           search?.trim()   || undefined,
      department:       department && department !== 'All'         ? department       : undefined,
      site:             site      && site      !== 'All'          ? site             : undefined,
      complianceStatus: complianceStatus && complianceStatus !== 'All' ? complianceStatus : undefined,
      // Default page 1, default limit 10 — service clamps these.
      page:  page  ? parseInt(page,  10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    };

    const { employees, pagination, summary } = await employeeService.getEmployeesByTenant(tenantId, filters);

    // Fire-and-forget VIEW audit — read operations must not block the response,
    // so we do NOT await this.  logAudit never throws (catches internally).
    logAudit({
      tenantId:  req.tenantId,
      userId:    req.user?._id?.toString(),
      userEmail: req.user?.email,
      action:    'EMPLOYEE_LIST_VIEWED',
      resource:  'EmployeeProfile',
      newValue:  { filters: { search: filters.search, department: filters.department, site: filters.site, complianceStatus: filters.complianceStatus }, page: filters.page },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(
      res,
      {
        count: employees.length,
        employees,
        pagination,
        summary,
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

    // Strip any tenantId the client may have sent — we ignore it and use the
    // tenant from the authenticated session. Stripping it also stops it being
    // spread into the employee document by the service's { ...profileData } spread.
    const { tenantId: _ignoredTenantId, ...profileData } = req.body;

    const { profile, isNew } = await employeeService.upsertEmployeeProfile(
      employeeId,
      profileData,
      {
        tenantId:  req.tenantId,
        userId:    req.user._id.toString(),
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

// Fetches a single employee profile by its SafeWork_Employee _id.
// Used by the profile detail page.
const getEmployeeById = async (req, res, next) => {
  try {
    const { profileId } = req.params;
    const employee = await employeeService.getEmployeeById(profileId);

    // Fire-and-forget — log who viewed which employee profile.
    logAudit({
      tenantId:  req.tenantId,
      userId:    req.user?._id?.toString(),
      userEmail: req.user?.email,
      action:    'EMPLOYEE_PROFILE_VIEWED',
      resource:  'EmployeeProfile',
      resourceId: profileId,
      newValue:  { viewedUserId: employee?.userId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, employee, 'Employee retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// Returns a short-lived pre-signed S3 GET URL so the frontend can open/download
// a stored compliance document directly from S3 without routing the file
// through this server.  URL expires in 15 minutes (900 s).
const getDocumentViewUrl = async (req, res, next) => {
  try {
    const { profileId } = req.params;
    const { docType } = req.query;

    if (!["medical", "bhp"].includes(docType)) {
      return sendError(res, "docType must be medical or bhp", 400);
    }

    const profile = await require('../models/employee').findById(profileId);
    if (!profile) return sendError(res, "Employee profile not found", 404);

    // Pick the correct S3 key depending on document type
    const s3Key =
      docType === "medical"
        ? profile.medicalCertificate?.documentPath
        : profile.bhpTraining?.documentPath;

    if (!s3Key) {
      return sendError(res, "No document stored for this type", 404);
    }

    const { generateDownloadUrl } = require('../utils/s3');
    const viewUrl = await generateDownloadUrl(s3Key);

    // Fire-and-forget — log who opened which document and for which profile.
    logAudit({
      tenantId:   req.tenantId,
      userId:     req.user?._id?.toString(),
      userEmail:  req.user?.email,
      action:     'DOCUMENT_VIEWED',
      resource:   'EmployeeDocument',
      resourceId: profileId,
      newValue:   { docType, s3Key },
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
    });

    return sendSuccess(res, { viewUrl, s3Key }, "Document URL generated");
  } catch (err) {
    next(err);
  }
};

// Returns a short-lived S3 pre-signed PUT URL so the frontend can upload
// a compliance document directly to S3 without routing the file through this server.
const getDocumentUploadUrl = async (req, res, next) => {
  try {
    const { profileId } = req.params;
    const { docType, fileName, contentType } = req.query;

    if (!["medical", "bhp"].includes(docType)) {
      return sendError(res, "docType must be medical or bhp", 400);
    }

    if (!fileName) {
      return sendError(res, "fileName is required", 400);
    }

    const { uploadUrl, s3Key } = await generateUploadUrl({
      profileId,
      docType,
      fileName,
      contentType,
    });

    return sendSuccess(res, { uploadUrl, s3Key }, "Upload URL generated");
  } catch (err) {
    next(err);
  }
};
// Saves the S3 key + metadata for a compliance document after a successful S3 upload.
// The tenant id comes from the authenticated session (req.tenantId) — any tenantId
// in the request body is ignored. This guarantees the audit log is stored against
// the user's real tenant, which is what the dashboard's AuditLog.find({ tenantId })
// query expects.
const saveDocumentReference = async (req, res, next) => {
  try {
    const { profileId } = req.params;
    const { docType, s3Key, expiryDate, completedDate, status } = req.body;

    const updated = await employeeService.updateDocumentReference(
      profileId,
      docType,
      { s3Key, expiryDate, completedDate, status },
      {
        tenantId:  req.tenantId,
        userId:    req.user._id.toString(),
        userEmail: req.user.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );
    return sendSuccess(res, updated, 'Document reference saved');
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
      req.tenantId,
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

module.exports = {
  getEmployees,
  getEmployeeById,
  getDocumentViewUrl,
  getDocumentUploadUrl,
  saveDocumentReference,
  upsertEmployeeProfile,
  updateEmployeeCompliance,
};
