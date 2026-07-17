const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Notification — reminders and alerts raised by the WorkPulse cron jobs.
// ─────────────────────────────────────────────────────────────────────────────
//
// The scheduled jobs (break reminder, open break, missing clock-out) create a
// record here for every alert they raise. Storing them gives us:
//   * an in-app inbox the frontend can show,
//   * a record for HR of what was flagged and when,
//   * a single place a real push/email sender can later read from and deliver.
//
// This service does NOT ship with a live push provider (that needs FCM/APNs
// infrastructure). The `channel` + `status` fields are the extension point: a
// delivery worker would pick up PENDING rows, send them, and mark them SENT.
const notificationSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    // Who should receive the alert.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    employeeId: { type: String },

    type: {
      type: String,
      enum: [
        'BREAK_DUE', // approaching / reached the 6-hour break point
        'OPEN_BREAK', // break started but not ended
        'MISSING_CLOCK_OUT', // shift ended, no clock-out recorded
        'OVERTIME_APPROVAL', // overtime needs a manager decision
        'REST_VIOLATION', // daily/weekly rest rule looks breached
      ],
      required: true,
    },

    channel: { type: String, enum: ['IN_APP', 'PUSH', 'EMAIL'], default: 'IN_APP' },

    title: { type: String, required: true },
    message: { type: String, required: true },

    // The time entry (or other record) this alert is about.
    relatedEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkPulse_TimeEntry' },

    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'READ', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    sentAt: { type: Date },
    readAt: { type: Date },
  },
  {
    collection: 'workplus_notifications',
    timestamps: true,
  }
);

notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports =
  mongoose.models.WorkPulse_Notification ||
  mongoose.model('WorkPulse_Notification', notificationSchema);
