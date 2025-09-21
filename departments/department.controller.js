const service = require('./department.service');

module.exports = { 
  getAll, 
  getById, 
  create, 
  update, 
  delete: _delete };

async function getAll(req, res, next) {
  try {
    const depts = await service.getAll();
    res.json(depts);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const dept = await service.getById(req.params.id);
    if (!dept) return res.sendStatus(404);
    res.json(dept);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const dept = await service.create(req.body);
    res.status(201).json(dept);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const dept = await service.update(req.params.id, req.body);
    res.json(dept);
  } catch (err) { next(err); }
}

async function _delete(req, res, next) {
  try {
    await service.delete(req.params.id);
    res.json({ message: 'Department deleted' });
  } catch (err) { next(err); }
}


