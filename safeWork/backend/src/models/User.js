const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User model for SafeWork platform authentication.
// Supports multi-tenancy via tenantId field — mandatory per platform architecture.
// Passwords are hashed pre-save; never stored in plaintext.
const userSchema = new mongoose.Schema(
  {
    // Tenant isolation — every document must be scoped to an organisation.
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    // RBAC roles aligned with platform-wide role taxonomy
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'EMPLOYEE', 'AUDITOR', 'COMPLIANCE_OFFICER'],
      default: 'EMPLOYEE',
    },

    isActive: { type: Boolean, default: true },

    // Audit metadata — required on all entities per architecture rules
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Hash password before save if it was modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare plaintext password against stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
