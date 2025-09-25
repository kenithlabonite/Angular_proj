// workflows/workflow.controller.js
const express = require('express');
const router = express.Router();
const workflowService = require('./workflow.service');

// ====== CREATE WORKFLOW ======
router.post('/', async (req, res, next) => {
  try {
    const workflow = await workflowService.create(req.body);
    res.status(201).json(workflow);
  } catch (err) {
    console.error('❌ Error creating workflow:', err);
    next(err);
  }
});

// ====== GET ALL WORKFLOWS (with optional employeeId filter) ======
router.get('/', async (req, res, next) => {
  try {
    const { employeeId } = req.query;
    const workflows = await workflowService.getAll(employeeId);
    res.json(workflows);
  } catch (err) {
    console.error('❌ Error fetching workflows:', err);
    next(err);
  }
});

// ====== GET WORKFLOW BY ID ======
router.get('/:id', async (req, res, next) => {
  try {
    const workflow = await workflowService.getById(req.params.id);
    res.json(workflow);
  } catch (err) {
    console.error('❌ Error fetching workflow by ID:', err);
    next(err);
  }
});

// ====== UPDATE WORKFLOW ======
router.put('/:id', async (req, res, next) => {
  try {
    const workflow = await workflowService.update(req.params.id, req.body);
    res.json(workflow);
  } catch (err) {
    console.error('❌ Error updating workflow:', err);
    next(err);
  }
});

// ====== APPROVE WORKFLOW ======
router.put('/:id/approve', async (req, res, next) => {
  try {
    const workflow = await workflowService.approve(req.params.id);
    res.json(workflow);
  } catch (err) {
    console.error('❌ Error approving workflow:', err);
    next(err);
  }
});

// ====== REJECT WORKFLOW ======
router.put('/:id/reject', async (req, res, next) => {
  try {
    const workflow = await workflowService.reject(req.params.id);
    res.json(workflow);
  } catch (err) {
    console.error('❌ Error rejecting workflow:', err);
    next(err);
  }
});

module.exports = router;
