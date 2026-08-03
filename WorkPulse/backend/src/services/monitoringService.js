const MonitoringAcknowledgement = require('../models/MonitoringAcknowledgement');
const policyService = require('./policyService');
const { logAudit } = require('../middleware/auditLogger');

// ─────────────────────────────────────────────────────────────────────────────
// Monitoring service — the Art. 22² "we told the employee" flow.
// ─────────────────────────────────────────────────────────────────────────────
// Gives the frontend the monitoring notice to show, records the employee's
// acknowledgement, and answers "has this employee agreed to the current notice?".

// The notice text + version + whether location tracking is even on for a tenant.
async function getNotice(tenantId) {
  const policy = await policyService.getOrCreateDefaultPolicy(tenantId);
  return {
    locationTrackingEnabled: policy.locationTrackingEnabled === true,
    noticeVersion: policy.monitoringNoticeVersion || '1.0',
    noticeText: policy.monitoringNoticeText || '',
  };
}

// Has this employee acknowledged the CURRENT notice version? Returns a small
// status object the Clock screen can use to decide whether to show the notice.
async function getStatus(tenantId, userId) {
  const notice = await getNotice(tenantId);

  // If tracking is off there is nothing to acknowledge.
  if (!notice.locationTrackingEnabled) {
    return { ...notice, acknowledged: true, required: false };
  }

  const ack = await MonitoringAcknowledgement.findOne({
    tenantId,
    userId,
    noticeVersion: notice.noticeVersion,
  }).lean();

  return {
    ...notice,
    required: true,
    acknowledged: Boolean(ack),
    acknowledgedAt: ack?.acknowledgedAt,
  };
}

// Fast check used by the clock flow: true when the employee may be tracked.
async function hasAcknowledgedCurrent(tenantId, userId) {
  const status = await getStatus(tenantId, userId);
  return status.acknowledged === true;
}

// Record that the employee has read and accepted the current notice.
async function acknowledge(tenantId, user, meta = {}) {
  const notice = await getNotice(tenantId);

  // Upsert so pressing "I understand" twice does not error or duplicate.
  const ack = await MonitoringAcknowledgement.findOneAndUpdate(
    { tenantId, userId: user._id, noticeVersion: notice.noticeVersion },
    {
      $set: {
        employeeId: user._id.toString(),
        acknowledgedAt: new Date(),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Record it in the immutable audit log too (extra evidence for inspectors).
  await logAudit({
    tenantId,
    userId: user._id.toString(),
    userEmail: user.email,
    action: 'MONITORING_NOTICE_ACKNOWLEDGED',
    resource: 'MonitoringAcknowledgement',
    resourceId: ack._id.toString(),
    newValue: { noticeVersion: notice.noticeVersion },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return ack;
}

module.exports = {
  getNotice,
  getStatus,
  hasAcknowledgedCurrent,
  acknowledge,
};
