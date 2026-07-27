const express = require('express');
const companyController = require('../controllers/companyController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');
const { requireWasteSyncModule } = require('../middleware/moduleGuard');
const { validate } = require('../middleware/validate');
const { companyRules } = require('../validators/companyValidator');

const router = express.Router();

// Every route requires a logged-in user with WasteSync access.
router.use(isAuthenticatedUser, requireWasteSyncModule);

// GET  /api/companies        — list all companies for the tenant
// POST /api/companies        — create a new company (validated)
router
  .route('/')
  .get(companyController.listCompanies)
  .post(companyRules, validate, companyController.createCompany);

// GET /api/companies/:id     — one company
// PUT /api/companies/:id     — update a company (validated)
router
  .route('/:id')
  .get(companyController.getCompany)
  .put(companyRules, validate, companyController.updateCompany);

module.exports = router;
