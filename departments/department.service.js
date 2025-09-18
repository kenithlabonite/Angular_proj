const db = require('_helpers/db');

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: _delete
};

async function getAll() {
  return await db.Department.findAll();
}

async function getById(id) {
  return await db.Department.findByPk(id);
}

async function create(params) {
  const department = new db.Department(params);
  await department.save();
  return department;
}

async function update(id, params) {
  const department = await getById(id);
  if (!department) throw 'Department not found';

  Object.assign(department, params);
  await department.save();
  return department;
}

async function _delete(id) {
  const department = await getById(id);
  if (!department) throw 'Department not found';

  await department.destroy();
}
