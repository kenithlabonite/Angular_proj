// employees/employees.controller.js
const express = require('express');
const router = express.Router();
const employeeService = require('./employee.service');
const authorize = require('_middleware/authorize');
const Role = require('_helpers/role');

// Routes
router.get('/', /* authorize(Role.Admin), */ getAll);
router.get('/next-id', /* authorize(Role.Admin), */ getNextId);
router.get('/:id', /* authorize(Role.Admin), */ getById);
router.post('/', /* authorize(Role.Admin), */ create);
router.put('/:id', /* authorize(Role.Admin), */ update);
router.delete('/:id', /* authorize(Role.Admin), */ _delete);

module.exports = router;

// ===== Controller Handlers =====

// Get all employees (with Department + Account)
async function getAll(req, res, next) {
  try {
    const employees = await employeeService.getAll({
      includeDepartment: true,
      includeAccount: true
    });
    res.json(employees);
  } catch (err) {
    console.error('Error in getAll:', err);
    next(err);
  }
}

// Generate next EmployeeID
async function getNextId(req, res, next) {
  try {
    const nextId = await employeeService.generateNextEmployeeID();
    res.json({ nextId });
  } catch (err) {
    console.error('Error in getNextId:', err);
    next(err);
  }
}

// Get one employee by EmployeeID
async function getById(req, res, next) {
  try {
    const employee = await employeeService.getById(req.params.id, {
      includeDepartment: true,
      includeAccount: true
    });
    if (!employee) return res.sendStatus(404);
    res.json(employee);
  } catch (err) {
    console.error('Error in getById:', err);
    next(err);
  }
}

// Create new employee
async function create(req, res, next) {
  try {
    const employee = await employeeService.create(req.body);
    res.status(201).json(employee);
  } catch (err) {
    console.error('Error in create:', err);
    next(err);
  }
}

// Update existing employee
async function update(req, res, next) {
  try {
    const employee = await employeeService.update(req.params.id, req.body);
    res.json(employee);
  } catch (err) {
    console.error('Error in update:', err);
    next(err);
  }
}

// Delete employee
async function _delete(req, res, next) {
  try {
    await employeeService.delete(req.params.id);
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    console.error('Error in delete:', err);
    next(err);
  }
}
