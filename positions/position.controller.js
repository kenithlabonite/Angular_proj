// positions/position.controller.js
const express = require('express');
const router = express.Router();
const positionService = require('./position.service'); // ✅ fixed path

// Routes
router.get('/', getAll);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;

// Controller functions
async function getAll(req, res, next) {
  try {
    const positions = await positionService.getAll();
    res.json(positions);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const position = await positionService.getById(req.params.id);
    res.json(position);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
}

async function create(req, res, next) {
  try {
    const position = await positionService.create(req.body);
    res.status(201).json(position);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function update(req, res, next) {
  try {
    const position = await positionService.update(req.params.id, req.body);
    res.json(position);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function remove(req, res, next) {
  try {
    const result = await positionService.remove(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
