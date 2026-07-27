const mongoose = require('mongoose');

const { Schema } = mongoose;

// Roles mirror the shared RegulaOne role enum. WorkPulse does not create users —
// it only reads them from the shared `users` collection to identify the caller.
const USER_ROLES = {
  ROLE_ADMIN: 'ROLE_ADMIN',
  ROLE_USER: 'ROLE_USER',
  ROLE_SUPER_ADMIN: 'ROLE_SUPER_ADMIN',
};

// The compliance modules a tenant/user may access. WORKPULSE gates this module.
const TENANT_MODULES = {
  KSEFFLOW: 'KSEFFLOW',
  WORKPULSE: 'WORKPULSE',
  SAFEWORK: 'SAFEWORK',
  SAFEVOICE: 'SAFEVOICE',
  WASTESYNC: 'WASTESYNC',
  PRIVACYPILOT: 'PRIVACYPILOT',
};

const userSchema = new Schema(
  {
    cognitoSub: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    role: { type: String, enum: Object.values(USER_ROLES), default: USER_ROLES.ROLE_USER },
    enabled: { type: Boolean, default: true },

    // Reference to the Tenant organisation. The Java backend stores this as a
    // MongoDB DBRef, so tenant isolation reads the nested `$id` field.
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: null },

    // Which compliance modules this user may open.
    moduleIds: {
      type: [{ type: String, enum: Object.values(TENANT_MODULES), trim: true }],
      default: [],
    },
  },
  {
    collection: 'users',
  }
);

// Guard against OverwriteModelError on nodemon hot-reload.
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = { User, USER_ROLES, TENANT_MODULES };
