const AuditLog         = require('../models/AuditLog');
const SafeWorkEmployee = require('../models/Employee');
const mongoose         = require('mongoose');

// Returns a paginated, filtered list of audit logs for a tenant.
// All parameters are optional — omitting them returns everything newest-first.
//
// filters: {
//   action?:    exact action string (e.g. 'EMPLOYEE_PROFILE_VIEWED')
//   userId?:    exact userId string
//   resource?:  exact resource string (e.g. 'EmployeeProfile')
//   search?:    case-insensitive text match on userEmail, action, resource, resourceId
//   startDate?: ISO date string — inclusive lower bound on createdAt
//   endDate?:   ISO date string — inclusive upper bound (set to 23:59:59 of that day)
//   page?:      page number (default 1)
//   limit?:     records per page (default 20, max 100)
// }
const getAuditLogs = async (tenantId, filters = {}) => {
  if (!tenantId) {
    throw { status: 400, message: 'tenantId is required' };
  }

  const {
    action,
    userId,
    resource,
    search,
    startDate,
    endDate,
    page  = 1,
    limit = 20,
  } = filters;

  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  // Build the MongoDB filter — always scope to the tenant.
  const query = { tenantId };

  if (action   && action   !== 'ALL') query.action   = action;
  if (userId)                         query.userId   = userId;
  if (resource && resource !== 'ALL') query.resource = resource;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      // Include the full end day up to 23:59:59.999
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  // Full-text style search across key string fields.
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    // $or must not conflict with existing query keys — merge carefully.
    query.$or = [
      { userEmail:  regex },
      { action:     regex },
      { resource:   regex },
      { resourceId: regex },
    ];
    // If action/resource filters were set alongside search they were already
    // added to query; $or will broaden, not narrow — acceptable trade-off.
  }

  // Run count + fetch in parallel for speed.
  const [total, rawLogs] = await Promise.all([
    AuditLog.countDocuments(query),
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  // Enrich each log entry with resourceName — the name of the employee whose
  // record was affected.  resourceId on EmployeeProfile / EmployeeDocument
  // actions is the SafeWork Employee _id; we look up the linked user's name
  // in a single aggregate call so the table shows "Jan Kowalski" not a raw ID.
  const resourceIds = [...new Set(rawLogs.map((l) => l.resourceId).filter(Boolean))];
  let nameMap = new Map();

  if (resourceIds.length > 0) {
    const validIds = resourceIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length > 0) {
      const nameRows = await SafeWorkEmployee.aggregate([
        { $match: { _id: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, name: { $ifNull: ['$user.name', '$name'] } } },
      ]);
      nameMap = new Map(nameRows.map((e) => [e._id.toString(), e.name || null]));
    }
  }

  const logs = rawLogs.map((log) => ({
    ...log,
    resourceName: nameMap.get(log.resourceId) || null,
  }));

  const totalPages = Math.ceil(total / limitNum) || 1;

  return {
    logs,
    pagination: { total, page: pageNum, limit: limitNum, totalPages },
  };
};

module.exports = { getAuditLogs };
