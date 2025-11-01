// requests/index.js
const express = require('express');
const router = express.Router();
const controller = require('./request.controller');
const authorize = require('_middleware/authorize');
const Role = require('_helpers/role');

// Save as Draft (user's own request, approvers can't see)
router.post('/draft', authorize(), controller.createSchema, controller.createDraft);

// Submit for approval (status = pending)
router.post('/pending', authorize(), controller.createSchema, controller.createPending);

// Approver / Manager view (hide drafts) - restricted to Admin/Approver
router.get('/visible', authorize([Role.Admin, Role.Approver]), controller.getAllVisibleToApprover);

// User view (includes own drafts)
router.get('/', authorize(), controller.getAll);

// Get single request by ID
router.get('/:id', authorize(), controller.getById);

// Update request
router.put('/:id', authorize(), controller.updateSchema, controller.update);

// Delete request
router.delete('/:id', authorize(), controller.delete);

module.exports = router;
