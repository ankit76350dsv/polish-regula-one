const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Role enum equivalent of Java Role enum.
 * Add/remove roles based on your backend role definitions.
 */
const USER_ROLES = {
  ROLE_ADMIN: 'ROLE_ADMIN',
  ROLE_USER: 'ROLE_USER',
  ROLE_SUPER_ADMIN: 'ROLE_SUPER_ADMIN',
};

const TENANT_MODULES = {
  KSEFFLOW: 'KSEFFLOW',
  WORKPULSE: 'WORKPULSE',
  SAFEWORK: 'SAFEWORK',
  SAFEVOICE: 'SAFEVOICE',
  WASTESYNC: 'WASTESYNC',
  PRIVACYPILOT: 'PRIVACYPILOT'
};

const userSchema = new Schema(
  {
    cognitoSub: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    name: {
      type: String,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      select: false
    },

    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.ROLE_USER
    },

    enabled: {
      type: Boolean,
      default: true
    },

    /**
     * Reference to Tenant organisation.
     *
     * Java equivalent:
     * @DBRef
     * private Tenant tenant;
     */
    tenant: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null
    },


    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: null
    },

    /**
     * List of compliance modules this user is allowed to access.
     *
     * Java equivalent:
     * private List<TenantModule> moduleIds = new ArrayList<>();
     *
     * If TenantModule is a separate MongoDB collection,
     * keep this as ObjectId ref array.
     */
    moduleIds: {
      type: [
        {
          type: String,
          enum: Object.values(TENANT_MODULES),
          trim: true
        }
      ],
      default: []
    }
  },
  {
    collection: 'users',
  }
  
);


// Guard against OverwriteModelError on nodemon hot-reload
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = {
  User,
  USER_ROLES,
  TENANT_MODULES,
};