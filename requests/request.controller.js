// requests/request.controller.js
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const requestService = require('./request.service');

module.exports = {
  getAll,
  getById,
  createSchema,
  create,
  updateSchema,
  update,
  delete: _delete
};

// ------------------ Schemas ------------------

function createSchema(req, res, next) {
  const schema = Joi.object({
    accountId: Joi.number().required(),
    employeeEmail: Joi.string().email().optional(),
    type: Joi.string().valid('equipment', 'leave', 'resources').required(),
    items: Joi.string().trim().min(1).required(),
    quantity: Joi.number().integer().min(1).required(),
    status: Joi.string().valid('pending', 'approved', 'disapproved', 'rejected').optional()
  });
  validateRequest(req, next, schema);
}

function updateSchema(req, res, next) {
  const schema = Joi.object({
    accountId: Joi.number().optional(),
    employeeEmail: Joi.string().email().optional(),
    type: Joi.string().valid('equipment', 'leave', 'resources').optional(),
    items: Joi.string().trim().min(1).optional(),
    quantity: Joi.number().integer().min(1).optional(),
    status: Joi.string().valid('pending', 'approved', 'disapproved', 'rejected').optional()
  });
  validateRequest(req, next, schema);
}

// ------------------ Handlers ------------------

async function getAll(req, res, next) {
  try {
    const list = await requestService.getAll();
    res.json(list);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const r = await requestService.getById(req.params.requestId);
    if (!r) return res.sendStatus(404);
    res.json(r);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const created = await requestService.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const updated = await requestService.update(req.params.requestId, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function _delete(req, res, next) {
  try {
    await requestService.delete(req.params.requestId);
    res.json({ message: 'Request deleted successfully' });
  } catch (err) {
    next(err);
  }
}
