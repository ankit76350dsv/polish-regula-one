const { body } = require('express-validator');

// Validation rules for the one company field WasteSync still owns.
//
// WHY THIS FILE SHRANK
// It used to validate a whole company form (name, NIP, REGON, address, contact
// details) because companies were created and edited here. They are not any
// more: the company is registered in the central RegulaOne platform and copied
// down from GET /api/tenant/info, so those fields are validated where they are
// entered — in RegulaOne — and are read-only in WasteSync.
//
// What is left is the BDO registration number, which RegulaOne does not store.
//
// These rules run BEFORE the controller (via the validate middleware), so by the
// time the controller runs the input is guaranteed to be clean. We never trust
// the frontend to validate for us.

const bdoRegistrationRules = [
  // The BDO number must be exactly 9 digits. We allow spaces in the input
  // (people type "123 456 789") and strip them before checking.
  body('bdoRegistrationNumber')
    .customSanitizer((value) => String(value ?? '').replace(/\s/g, ''))
    .matches(/^\d{9}$/)
    .withMessage('BDO registration number must be exactly 9 digits'),
];

module.exports = { bdoRegistrationRules };
