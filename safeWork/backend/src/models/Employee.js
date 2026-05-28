const mongoose = require('mongoose');

const employeeProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    employeeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
    },

    // Personal identity
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    // Polish national identifier
    pesel: {
      type: String,
      trim: true,
    },

    // Employment details
    department: {
      type: String,
      trim: true,
    },

    position: {
      type: String,
      trim: true,
    },

    site: {
      type: String,
      trim: true,
    },

    contractType: {
      type: String,
      enum: ['UOP', 'UZ', 'UOD', 'B2B', 'OTHER'],
      default: 'UOP',
    },

    startDate: {
      type: Date,
    },

    medicalCertificate: {
      status: {
        type: String,
        enum: ['VALID', 'EXPIRING', 'EXPIRED', 'MISSING'],
        default: 'MISSING',
      },
      expiryDate: {
        type: Date,
      },
      documentPath: {
        type: String,
      },
    },

    bhpTraining: {
      status: {
        type: String,
        enum: ['VALID', 'EXPIRING', 'EXPIRED', 'MISSING'],
        default: 'MISSING',
      },
      completedDate: {
        type: Date,
      },
      expiryDate: {
        type: Date,
      },
    },

    complianceStatus: {
      type: String,
      enum: ['COMPLIANT', 'EXPIRING', 'NON_COMPLIANT', 'BLOCKED'],
      default: 'NON_COMPLIANT',
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    blockReason: {
      type: String,
    },

    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: String,
    },

    updatedBy: {
      type: String,
    },
  },
  {
    collection: 'safework_employees',
    timestamps: true,
  }
);

// Guard against OverwriteModelError on nodemon hot-reload: reuse the already-compiled model if it exists
module.exports = mongoose.models.SafeWork_Employee || mongoose.model('SafeWork_Employee', employeeProfileSchema);