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
  createDraft,
  createPending,
  updateSchema,
  update,
  delete: _delete,
};

// Base Joi schema
const baseSchema = {
  type: Joi.string().valid('equipment', 'leave', 'resources').required(),
  items: Joi.string().trim().min(1).required(),
  quantity: Joi.number().integer().min(1).required(),
};

function createSchema(req, res, next) {
  const schema = Joi.object({ ...baseSchema, status: Joi.string().valid('draft', 'pending').optional() });
  validateRequest(req, next, schema);
}

function updateSchema(req, res, next) {
  const schema = Joi.object({
    status: Joi.string().valid('draft', 'pending', 'approved', 'rejected').optional(),
    items: Joi.string().min(1).optional(),
    type: Joi.string().valid('equipment', 'leave', 'resources').optional(),
    quantity: Joi.number().integer().min(1).optional(),
  });
  validateRequest(req, next, schema);
}

// Return current user's requests (includes drafts)
async function getAll(req, res, next) {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ message: 'Unauthorized' });
    const list = await requestService.getAll(user.id);
    res.json(list);
  } catch (err) { next(err); }
}

// Approver view: hide drafts
async function getAllVisibleToApprover(req, res, next) {
  try {
    const user = req.user;
    if (!user || !user.role) return res.status(401).json({ message: 'Unauthorized' });
    const role = String(user.role).toLowerCase();
    if (role !== 'admin' && role !== 'approver') return res.status(403).json({ message: 'Forbidden' });

    const list = await requestService.getAllVisibleToApprover();
    res.json(list);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const id = req.params.id;
    const r = await requestService.getById(id);
    if (!r) return res.status(404).json({ message: 'Request not found' });
    res.json(r);
  } catch (err) { next(err); }
}

// Generic create (enforces ownership)
async function create(req, res, next) {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ message: 'Unauthorized' });
    req.body.accountId = req.user.id;
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
    const id = req.params.id;
    const updated = await requestService.update(id, req.body);
    res.json(updated);
  } catch (err) { next(err); }
}

async function _delete(req, res, next) {
  try {
    const id = req.params.id;
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ message: 'Unauthorized' });

    const r = await requestService.getById(id);
    if (!r) return res.status(404).json({ message: 'Request not found' });

    const isOwner = r.accountId && Number(r.accountId) === Number(user.id);
    const isAdmin = String(user.role).toLowerCase() === 'admin';

    if (r.status === 'draft' || isOwner || isAdmin) {
      await requestService.delete(id);
      return res.json({ message: 'Request deleted' });
    }

    return res.status(403).json({ message: 'Cannot delete request: only draft, owner, or admin may delete.' });
  } catch (err) { next(err); }
}
