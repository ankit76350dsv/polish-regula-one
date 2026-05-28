const mongoose = require('mongoose');

// Employee Profile model for SafeWork HR compliance tracking.
// Tracks BHP training, medical certificates, and work-blocking status.
// Polish fields (PESEL, NIP) are included per platform compliance requirements.
const employeeProfileSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    dateOfBirth: { type: Date },

    // Personal identity
    Name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },

    // Polish national identifier — required for labour law compliance
    pesel: { type: String, trim: true },

    // Employment details
    department: { type: String, trim: true },
    position: { type: String, trim: true },
    site: { type: String, trim: true }, // Physical work location
    contractType: {
      type: String,
      enum: ['UOP', 'UZ', 'UOD', 'B2B', 'OTHER'],
      default: 'UOP',
    },
    startDate: { type: Date },

    // Medical certificate compliance
    medicalCertificate: {
      status: {
        type: String,
        enum: ['VALID', 'EXPIRING', 'EXPIRED', 'MISSING'],
        default: 'MISSING',
      },
      expiryDate: { type: Date },
      documentPath: { type: String },
    },

    // BHP training compliance
    bhpTraining: {
      status: {
        type: String,
        enum: ['VALID', 'EXPIRING', 'EXPIRED', 'MISSING'],
        default: 'MISSING',
      },
      completedDate: { type: Date },
      expiryDate: { type: Date },
    },

    // Overall compliance status
    complianceStatus: {
      type: String,
      enum: ['COMPLIANT', 'EXPIRING', 'NON_COMPLIANT', 'BLOCKED'],
      default: 'NON_COMPLIANT',
    },

    // Work-blocking flag
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String },

    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM',
    },

    isActive: { type: Boolean, default: true },

    // Audit metadata
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('EmployeeProfile', employeeProfileSchema);