const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');

// Aggregates compliance statistics for the dashboard.
// All queries are tenant-scoped to prevent cross-tenant data leakage.
const getDashboardStats = async (tenantId) => {
  const [employees, recentAuditLogs] = await Promise.all([
    Employee.find({ tenantId, isActive: true }),
    AuditLog.find({ tenantId }).sort({ createdAt: -1 }).limit(20),
  ]);

  const now = new Date();
  // "Expiring soon" = certificate/training expires within 30 days
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const total = employees.length;
  const compliant = employees.filter((e) => e.complianceStatus === 'COMPLIANT').length;
  const expiring = employees.filter((e) => e.complianceStatus === 'EXPIRING').length;
  const blocked = employees.filter((e) => e.isBlocked).length;
  const missingDocs = employees.filter(
    (e) => e.medicalCertificate.status === 'MISSING' || e.bhpTraining.status === 'MISSING'
  ).length;

  // Employees with any document expiring in the next 30 days
  const expiringDocuments = employees.filter((e) => {
    const medExpiry = e.medicalCertificate?.expiryDate;
    const bhpExpiry = e.bhpTraining?.expiryDate;
    return (
      (medExpiry && medExpiry <= thirtyDaysFromNow && medExpiry >= now) ||
      (bhpExpiry && bhpExpiry <= thirtyDaysFromNow && bhpExpiry >= now)
    );
  });

  const blockedEmployees = employees.filter((e) => e.isBlocked);

  return {
    summary: { total, compliant, expiring, blocked, missingDocs },
    employees,
    expiringDocuments,
    blockedEmployees,
    recentAuditLogs,
  };
};

module.exports = { getDashboardStats };
