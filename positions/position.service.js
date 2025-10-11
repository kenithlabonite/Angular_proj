// positions/position.service.js
const db = require('../_helpers/db');

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};

// ✅ Get all positions
async function getAll() {
  return await db.Position.findAll();
}

// ✅ Get a position by ID
async function getById(id) {
  const position = await db.Position.findByPk(id);
  if (!position) throw new Error('Position not found');
  return position;
}

// ✅ Create a new position
async function create(params) {
  if (!params.position) throw new Error('Position name is required');

  const existing = await db.Position.findOne({ where: { position: params.position } });
  if (existing) throw new Error(`Position "${params.position}" already exists`);

  const newPosition = await db.Position.create(params);
  return newPosition;
}

// ✅ Update a position by ID
async function update(id, params) {
  const position = await getById(id);

  // Check for duplicate if updating name
  if (params.position && params.position !== position.position) {
    const duplicate = await db.Position.findOne({ where: { position: params.position } });
    if (duplicate) throw new Error(`Position "${params.position}" already exists`);
  }

  Object.assign(position, params);
  await position.save();
  return position;
}

// ✅ Delete a position by ID
async function remove(id) {
  const position = await getById(id);
  await position.destroy();
  return { message: 'Position deleted successfully' };
}
