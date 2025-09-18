// requests/request.service.js
const db = require('_helpers/db');

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: _delete
};

// ------------------------- Get all -------------------------
async function getAll() {
  return await db.Request.findAll({
    include: { model: db.Account, attributes: ['id', 'email'] },
    order: [['created', 'DESC']]
  });
}

// ------------------------- Get by id -------------------------
async function getById(id) {
  return await db.Request.findByPk(id, {
    include: { model: db.Account, attributes: ['id', 'email'] }
  });
}

// ------------------------- Create -------------------------
async function create(params) {
  // validate accountId
  if (!params.accountId) throw 'accountId is required';
  const account = await db.Account.findByPk(params.accountId);
  if (!account) throw 'Related account not found for given accountId';

  // validate type
  const allowedTypes = ['equipment', 'leave', 'resources'];
  if (!allowedTypes.includes((params.type || '').toString())) {
    throw 'Invalid request type';
  }

  // validate status
  const allowedStatus = ['pending', 'approved', 'disapproved', 'rejected'];
  if (params.status && !allowedStatus.includes(params.status)) {
    throw 'Invalid status';
  }

  const r = await db.Request.create({
    accountId: params.accountId,
    type: params.type,
    items: params.items,
    status: params.status || 'pending',
    created: new Date()
  });

  return await getById(r.id);
}

// ------------------------- Update -------------------------
async function update(id, params) {
  const request = await db.Request.findByPk(id);
  if (!request) throw 'Request not found';

  // if changing accountId, validate target account exists
  if (params.accountId && params.accountId !== request.accountId) {
    const account = await db.Account.findByPk(params.accountId);
    if (!account) throw 'Related account not found for new accountId';
  }

  // validate type/status
  const allowedTypes = ['equipment', 'leave', 'resources'];
  const allowedStatus = ['pending', 'approved', 'disapproved', 'rejected'];

  if (params.type && !allowedTypes.includes(params.type)) throw 'Invalid request type';
  if (params.status && !allowedStatus.includes(params.status)) throw 'Invalid status';

  // copy only allowed fields
  const allowed = ['accountId', 'type', 'items', 'status'];
  for (const f of allowed) {
    if (Object.prototype.hasOwnProperty.call(params, f)) {
      request[f] = params[f];
    }
  }

  request.updated = new Date();
  await request.save();
  return await getById(request.id);
}

// ------------------------- Delete -------------------------
async function _delete(id) {
  const r = await db.Request.findByPk(id);
  if (!r) throw 'Request not found';
  await r.destroy();
}
