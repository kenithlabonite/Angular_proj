const express = require('express');
const router = express.Router();
const workflowService = require('./workflow.service');

// Create a new workflow
router.post('/', async (req, res, next) => {
  try {
    const workflow = await workflowService.create(req.body);
    res.status(201).json(workflow);
  } catch (err) {
    next(err);
  }
});

// Get all workflows
router.get('/', async (req, res, next) => {
  try {
    const workflows = await workflowService.getAll();
    res.json(workflows);
  } catch (err) {
    next(err);
  }
});

// Get workflow by id
router.get('/:id', async (req, res, next) => {
  try {
    const workflow = await workflowService.getById(req.params.id);
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// Update workflow
router.put('/:id', async (req, res, next) => {
  try {
    const workflow = await workflowService.update(req.params.id, req.body);
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// Approve workflow
router.put('/:id/approve', async (req, res, next) => {
  try {
    const workflow = await workflowService.approve(req.params.id);
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// Reject workflow
router.put('/:id/reject', async (req, res, next) => {
  try {
    const workflow = await workflowService.reject(req.params.id);
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
