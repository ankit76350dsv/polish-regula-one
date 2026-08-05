const express = require('express');
const companyController = require('../controllers/companyController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { validate } = require('../middleware/validate');
const { bdoRegistrationRules } = require('../validators/companyValidator');
const { CAPABILITIES } = require('../config/permissions');

const router = express.Router();

// ── How access is decided in every WasteSync route file ──────────────────────
//
// FOUR checks run, in this order:
//
//   1. isAuthenticatedUser      -> "are you logged in?"             (Cognito token)
//   2. requireWasteSyncModule   -> "did your company buy WasteSync?"  (licence)
//   3. authorizePermissions     -> "were YOU given WasteSync?"      (front door)
//   4. authorizeCapability      -> "may you do THIS ONE THING?"     (per route)
//
// Checks 1–3 use router.use(), so they apply to every route below and a new
// endpoint can never be left unprotected by accident.
//
// Check 4 is written on each route because it is different for each one. It names
// an ACTION (COMPANY_READ, REPORT_SUBMIT, ...), never a job title. The table in
// config/permissions.js says which job title is given which actions:
//
//   ACTION            | ADMIN | HR_MANAGER | AUDITOR
//   ------------------|-------|------------|---------
//   DASHBOARD_READ    |  yes  |    yes     |  yes
//   COMPANY_READ      |  yes  |    yes     |  yes
//   COMPANY_WRITE     |  yes  |    yes     |  no
//   WASTE_ENTRY_READ  |  yes  |    yes     |  yes
//   WASTE_ENTRY_WRITE |  yes  |    yes     |  no
//   REPORT_READ       |  yes  |    yes     |  yes
//   REPORT_GENERATE   |  yes  |    yes     |  no
//   REPORT_EXPORT     |  yes  |    yes     |  yes   <- evidence, not a change
//   REPORT_SUBMIT     |  yes  |    no      |  no    <- confirms a legal filing
//   THRESHOLD_READ    |  yes  |    yes     |  yes
//   THRESHOLD_WRITE   |  yes  |    no      |  no    <- sets the legal limit
//   AUDIT_READ        |  yes  |    no      |  yes
//
// To change what a job title may do, edit that table — not these routes.
router.use(isAuthenticatedUser, requireWasteSyncModule, authorizePermissions());

// ── There is no company CRUD here, on purpose ────────────────────────────────
//
// REMOVED: GET/POST /api/companies, GET/PUT /api/companies/:id.
//
// They managed a local Company collection that duplicated the customer's company
// record in RegulaOne. One customer has exactly one company, registered in
// RegulaOne at sign-up, so the copy could only ever agree with the original or
// disagree with it — and those details are printed on reports filed with a
// government register, where a mismatch is a filing error.
//
// Waste entries and reports are now scoped by tenantId, which the auth middleware
// resolves from the verified session, so there is no company id to fetch, pass
// around, or accidentally leak between tenants.

// GET /api/companies/profile     — the company, read live from RegulaOne
router
  .route('/profile')
  .get(authorizeCapability(CAPABILITIES.COMPANY_READ), companyController.getCompanyProfile);

// PUT /api/companies/profile/bdo — set/correct the 9-digit BDO number
//
// This is the ONLY company value WasteSync stores, because RegulaOne does not
// hold it. It is printed on every report the authority receives, so it is a
// write: auditors may read the profile but never change this number.
router
  .route('/profile/bdo')
  .put(
    authorizeCapability(CAPABILITIES.COMPANY_WRITE),
    bdoRegistrationRules,
    validate,
    companyController.updateBdoRegistration
  );

module.exports = router;
