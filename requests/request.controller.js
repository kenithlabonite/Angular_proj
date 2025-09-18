// requests/request.controller.js
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize'); // optional use
const requestService = require('./request.service');

// routes
router.get('/', /* authorize(), */ getAll);
router.get('/:id', /* authorize(), */ getById);
router.post('/', /* authorize(), */ createSchema, create);
router.put('/:id', /* authorize(), */ updateSchema, update);
router.delete('/:id', /* authorize(), */ _delete);

module.exports = router;

/* Handlers + Schemas */

function getAll(req, res, next) {
  requestService.getAll()
    .then(requests => res.json(requests))
    .catch(next);
}

function getById(req, res, next) {
  requestService.getById(req.params.id)
    .then(r => r ? res.json(r) : res.sendStatus(404))
    .catch(next);
}

function createSchema(req, res, next) {
  const schema = Joi.object({
    type: Joi.string().valid('equipment', 'leave', 'resources').required(),
    employeeEmail: Joi.string().email().required(),
    items: Joi.string().required(),
    status: Joi.string().valid('pending', 'approved', 'disapproved').optional()
  });
  validateRequest(req, next, schema);
}

function create(req, res, next) {
  requestService.create(req.body)
    .then(r => res.json(r))
    .catch(next);
}

function updateSchema(req, res, next) {
  const schema = Joi.object({
    type: Joi.string().valid('equipment', 'leave', 'resources').optional(),
    employeeEmail: Joi.string().email().optional(),
    items: Joi.string().optional(),
    status: Joi.string().valid('pending', 'approved', 'disapproved').optional()
  });
  validateRequest(req, next, schema);
}

function update(req, res, next) {
  requestService.update(req.params.id, req.body)
    .then(r => res.json(r))
    .catch(next);
}

function _delete(req, res, next) {
  requestService.delete(req.params.id)
    .then(() => res.json({ message: 'Request deleted successfully' }))
    .catch(next);
}
