// employees/employees.controller.js
const express = require('express');
const router = express.Router();
const employeeService = require('./employee.service');
const authorize = require('_middleware/authorize');
const Role = require('_helpers/role');
const db = require('../_helpers/db'); // needed for direct employee lookup

// ===== Routes =====
router.get('/', /* authorize(Role.Admin), */ getAll);
router.get('/next-id', /* authorize(Role.Admin), */ getNextId);
router.get('/:id', /* authorize(Role.Admin), */ getById);
router.post('/', authorize(Role.Admin), create);
router.put('/:id', /* authorize(Role.Admin), */ update);
router.delete('/:id', /* authorize(Role.Admin), */ _delete);

// 🚀 New: Transfer employee to another department
router.post('/:id/transfer', /* authorize(Role.Admin), */ transferDepartment);

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

// ===== New Transfer Handler =====
async function transferDepartment(req, res, next) {
  try {
    const employeeId = req.params.id;
    const { toDeptId } = req.body;

    if (!toDeptId) {
      return res.status(400).json({ message: 'toDeptId is required' });
    }

    const employee = await db.Employee.findByPk(employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const fromDeptId = employee.departmentId;
    employee.departmentId = toDeptId;
    await employee.save();

    res.json({
      message: `Employee ${employeeId} transferred successfully`,
      fromDeptId,
      toDeptId,
      employee
    });
  } catch (err) {
    console.error('Error in transferDepartment:', err);
    next(err);
  }
}
