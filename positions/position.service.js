// positions/position.service.js
const db = require("../_helpers/db");

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  updateStatus, // ✅ Added new function
};

// ✅ Get all positions
async function getAll() {
  return await db.Position.findAll();
}

// ✅ Get a position by ID
async function getById(id) {
  const position = await db.Position.findByPk(id);
  if (!position) throw new Error("Position not found");
  return position;
}

// ✅ Create a new position
async function create(params) {
  if (!params.position) throw new Error("Position name is required");

  const existing = await db.Position.findOne({
    where: { position: params.position },
  });
  if (existing) throw new Error(`Position "${params.position}" already exists`);

  return await db.Position.create(params);
}

// ✅ Update a position (name, etc.)
async function update(id, params) {
  const position = await getById(id);

  // Prevent duplicate names
  if (params.position && params.position !== position.position) {
    const duplicate = await db.Position.findOne({
      where: { position: params.position },
    });
    if (duplicate)
      throw new Error(`Position "${params.position}" already exists`);
  }

  Object.assign(position, params);
  await position.save();
  return position;
}

// ✅ Delete a position
async function remove(id) {
  const position = await getById(id);
  await position.destroy();
  return { message: "Position deleted successfully" };
}

// ✅ NEW: Update only the status field
async function updateStatus(id, status) {
  if (!["active", "deactive"].includes(status)) {
    throw new Error("Invalid status value. Must be 'active' or 'deactive'.");
  }

  const position = await getById(id);
  position.status = status;
  await position.save();

  return {
    message: `Position "${position.position}" status updated to "${status}".`,
    position,
  };
}
