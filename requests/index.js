// requests/index.js
const express = require('express');
const router = express.Router();
const controller = require('./request.controller');
const authorize = require('_middleware/authorize'); // ensure this middleware sets req.user
const Role = require('_helpers/role'); // for role constants if needed

// Special endpoints
router.post('/submit', controller.createPendingSchema, controller.createPending);
router.post('/draft', controller.createDraftSchema, controller.createDraft);
router.get('/approver', authorize(/* Approver role if you have one */), controller.getAllVisibleToApprover);

// CRUD
router.get('/', authorize(), controller.getAll); // require auth
router.get('/:requestId', authorize(), controller.getById);
router.post('/', authorize(), controller.createSchema, controller.create);
router.put('/:requestId', authorize(), controller.updateSchema, controller.update);

// IMPORTANT: require authentication for delete and ensure controller uses req.user
router.delete('/:requestId', authorize(), controller.delete);

module.exports = router;
