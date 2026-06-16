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

    // Personal identity — denormalised from RegulaOne for quick reads.
    // Not required: identity is authoritative in RegulaOne (users collection).
    // Upsert always joins via userId so these are optional cache fields only.
    // OLD: required: true — removed because upsert never sends identity fields,
    //      causing Mongoose validation to fail on every save.
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
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
      // Added to mirror medicalCertificate — stores S3 object key for the uploaded BHP certificate
      documentPath: {
        type: String,
      },
    },

    // Explicit flags for whether this position requires each compliance document.
    // Added because using medicalCertificate.status presence as a proxy was
    // ambiguous — the schema defaults create the sub-object for every employee,
    // making it impossible to distinguish "not required" from "required but missing".
    requiresMedicalCertificate: {
      type: Boolean,
      default: false,
    },

    requiresBHPTraining: {
      type: Boolean,
      default: false,
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