const mongoose = require('mongoose');

const { Schema } = mongoose;

// The roles a user can have across the RegulaOne platform.
// This matches the shape used by SafeWork and the Java RegulaOne backend, so
// the SAME user document works in every module.
const USER_ROLES = {
  ROLE_ADMIN: 'ROLE_ADMIN',
  ROLE_USER: 'ROLE_USER',
  ROLE_SUPER_ADMIN: 'ROLE_SUPER_ADMIN',
};

// The list of products a tenant/user can be given access to.
const TENANT_MODULES = {
  KSEFFLOW: 'KSEFFLOW',
  WORKPULSE: 'WORKPULSE',
  SAFEWORK: 'SAFEWORK',
  SAFEVOICE: 'SAFEVOICE',
  WASTESYNC: 'WASTESYNC',
  PRIVACYPILOT: 'PRIVACYPILOT',
};

// IMPORTANT: this maps to the SAME "users" collection that RegulaOne and the
// other modules use. WasteSync only READS user identity from it — it never
// creates or changes login details. Login is owned by RegulaOne SSO.
const userSchema = new Schema(
  {
    cognitoSub: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    // Present in the shared schema but never used by WasteSync (login is SSO).
    password: {
      type: String,
      select: false,
    },

    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.ROLE_USER,
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    // Which organisation (tenant) this user belongs to. The authoritative value
    // comes from RegulaOne at request time; this stored ref is only a fallback.
    tenant: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: null,
    },

    // The compliance modules this user is allowed to open. WasteSync's
    // moduleGuard checks that WASTESYNC is in this list.
    moduleIds: {
      type: [
        {
          type: String,
          enum: Object.values(TENANT_MODULES),
          trim: true,
        },
      ],
      default: [],
    },
  },
  {
    // Maps to the SHARED "users" collection that RegulaOne (the SSO service) and
    // every module read/write. This must point at the same collection RegulaOne
    // populates, because the auth middleware logs users in by looking them up
    // here. WasteSync's OWN data lives in separate wastesync_* collections and is
    // isolated by tenantId — it does not need a private users collection.
    collection: 'users',
  }
);

// Guard against an "OverwriteModelError" when nodemon hot-reloads the file.
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = {
  User,
  USER_ROLES,
  TENANT_MODULES,
};
