const ErrorHandler = require('../utils/ErrorHandler');
const { TENANT_MODULES } = require('../models/User');

// Makes sure the logged-in user is actually allowed to use the WasteSync module.
// A RegulaOne user can have access to several modules (KSeFFlow, SafeWork, ...).
// This guard rejects users who do not have WASTESYNC in their module list.
//
// We run this AFTER isAuthenticatedUser, so req.user is already set.
const requireWasteSyncModule = (req, res, next) => {
  const modules = req.user?.moduleIds || [];

  // ROLE_SUPER_ADMIN can see everything, so we let them through regardless.
  if (req.user?.role === 'ROLE_SUPER_ADMIN') {
    return next();
  }

  if (!modules.includes(TENANT_MODULES.WASTESYNC)) {
    return next(
      new ErrorHandler('Your account does not have access to the WasteSync module', 403)
    );
  }

  next();
};

module.exports = { requireWasteSyncModule };
