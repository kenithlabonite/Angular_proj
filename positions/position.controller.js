// src/positions/position.controller.js
const express = require('express');
const router = express.Router();
const positionService = require('./position.service');

// ===== ROUTES =====
router.get('/', getAll);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/status', updateStatus);
router.delete('/:id', remove);

module.exports = router;

// ===== CONTROLLERS =====

async function getAll(req, res, next) {
  try {
    const positions = await positionService.getAll();
    res.json(positions);
  } catch (err) {
    console.error('❌ Failed to get positions:', err);
    res.status(500).json({ message: err.message || 'Failed to get positions' });
  }
}

async function getById(req, res, next) {
  try {
    const position = await positionService.getById(req.params.id);
    if (!position) return res.status(404).json({ message: 'Position not found' });
    res.json(position);
  } catch (err) {
    console.error('❌ Failed to get position by ID:', err);
    res.status(404).json({ message: err.message || 'Position not found' });
  }
}

async function create(req, res, next) {
  try {
    const position = await positionService.create(req.body);
    res.status(201).json(position);
  } catch (err) {
    console.error('❌ Failed to create position:', err);
    res.status(400).json({ message: err.message || 'Failed to create position' });
  }
}

async function update(req, res, next) {
  try {
    const position = await positionService.update(req.params.id, req.body);
    res.json(position);
  } catch (err) {
    console.error('❌ Failed to update position:', err);
    res.status(400).json({ message: err.message || 'Failed to update position' });
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const result = await positionService.updateStatus(req.params.id, status);
    res.json(result);
  } catch (err) {
    console.error('❌ Failed to update position status:', err);
    res.status(400).json({ message: err.message || 'Failed to update position status' });
  }
}

async function remove(req, res, next) {
  try {
    const result = await positionService.remove(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('❌ Failed to delete position:', err);
    res.status(400).json({ message: err.message || 'Failed to delete position' });
  }
}
