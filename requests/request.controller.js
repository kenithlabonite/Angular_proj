// requests/request.controller.js
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const requestService = require('./request.service');
const Role = require('_helpers/role');

module.exports = {
  getAll,
  getAllVisibleToApprover,
  getById,
  createSchema,
  create,
  createDraftSchema,
  createDraft,
  createPendingSchema,
  createPending,
  updateSchema,
  update,
  delete: _delete,
};

// Base schema (items accepted as JSON string)
const baseSchema = {
  accountId: Joi.number().optional(),
  employeeEmail: Joi.string().email().optional(),
  type: Joi.string().valid('equipment', 'leave', 'resources').required(),
  items: Joi.string().trim().min(1).required(),
  quantity: Joi.number().integer().min(1).required(),
};

function createSchema(req, res, next) {
  const schema = Joi.object({ ...baseSchema, status: Joi.string().valid('draft', 'pending', 'approved', 'rejected').optional() });
  validateRequest(req, next, schema);
}

function createDraftSchema(req, res, next) {
  const schema = Joi.object({ ...baseSchema, status: Joi.string().valid('draft').optional() });
  validateRequest(req, next, schema);
}

function createPendingSchema(req, res, next) {
  const schema = Joi.object({ ...baseSchema, status: Joi.string().valid('pending').optional() });
  validateRequest(req, next, schema);
}

function updateSchema(req, res, next) {
  const schema = Joi.object({
    status: Joi.string().valid('draft', 'pending', 'approved', 'rejected').optional(),
    items: Joi.string().min(1).optional(),
    type: Joi.string().valid('equipment', 'leave', 'resources').optional(),
    quantity: Joi.number().integer().min(1).optional(),
    accountId: Joi.number().optional(),
  });
  validateRequest(req, next, schema);
}

// handlers
async function getAll(req, res, next) {
  try {
    const list = await requestService.getAll();
    res.json(list);
  } catch (err) { next(err); }
}

async function getAllVisibleToApprover(req, res, next) {
  try {
    const list = await requestService.getAllVisibleToApprover();
    res.json(list);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const id = req.params.requestId || req.params.id;
    const r = await requestService.getById(id);
    if (!r) return res.status(404).json({ message: 'Request not found' });
    res.json(r);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const created = await requestService.create(req.body);
    res.status(201).json(created);
  } catch (err) { next(err); }
}

async function createDraft(req, res, next) {
  req.body.status = 'draft';
  return create(req, res, next);
}

async function createPending(req, res, next) {
  req.body.status = 'pending';
  return create(req, res, next);
}

async function update(req, res, next) {
  try {
    const id = req.params.requestId || req.params.id;
    const updated = await requestService.update(id, req.body);
    res.json(updated);
  } catch (err) { next(err); }
}

async function _delete(req, res, next) {
  try {
    const id = req.params.requestId || req.params.id;

    // Ensure authentication middleware set req.user
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const r = await requestService.getById(Number(id));
    if (!r) return res.status(404).json({ message: 'Request not found' });

    // Deletion policy:
    // allow delete if request.status === 'draft' OR owner OR admin
    const isOwner = r.accountId && user.id && Number(r.accountId) === Number(user.id);
    const isAdmin = user.role && user.role.toString().toLowerCase() === (Role.Admin || 'admin').toLowerCase();

    if (r.status === 'draft' || isOwner || isAdmin) {
      await requestService.delete(Number(id));
      return res.json({ message: 'Request deleted' });
    }

    // forbidden
    return res.status(403).json({ message: 'Cannot delete request: only draft requests, the owner, or an admin may delete this.' });
  } catch (err) {
    console.error('Error deleting request:', err);
    return next(err);
  }
}
