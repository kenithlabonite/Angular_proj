// departments/index.js
const express = require('express');
const router = express.Router();
const controller = require('./department.controller');

// ✅ Each route points to a function, not the whole controller object
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
