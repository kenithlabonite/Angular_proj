// requests/index.js
const express = require('express');
const router = express.Router();
const controller = require('./request.controller');

router.get('/', controller.getAll);
router.get('/:requestId', controller.getById);
router.post('/', controller.createSchema, controller.create);
router.put('/:requestId', controller.updateSchema, controller.update);
router.post('/:requestId', controller.updateSchema, controller.update);
router.delete('/:requestId', controller.delete);

module.exports = router;
