const express = require('express');
const companyController = require('../controllers/companyController');
const {
  isAuthenticatedUser,
  authorizePermissions,
  authorizeCapability,
} = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { validate } = require('../middleware/validate');
const { companyRules } = require('../validators/companyValidator');
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

// GET  /api/companies        — list all companies for the tenant
// POST /api/companies        — create a new company (validated)
//
// Creating a company sets its BDO registration number, which is printed on every
// report the authority receives. That makes it a write, so auditors cannot do it.
router
  .route('/')
  .get(authorizeCapability(CAPABILITIES.COMPANY_READ), companyController.listCompanies)
  .post(
    authorizeCapability(CAPABILITIES.COMPANY_WRITE),
    companyRules,
    validate,
    companyController.createCompany
  );

// GET /api/companies/:id     — one company
// PUT /api/companies/:id     — update a company (validated)
router
  .route('/:id')
  .get(authorizeCapability(CAPABILITIES.COMPANY_READ), companyController.getCompany)
  .put(
    authorizeCapability(CAPABILITIES.COMPANY_WRITE),
    companyRules,
    validate,
    companyController.updateCompany
  );

module.exports = router;
