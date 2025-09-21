// requests/request.service.js
const db = require('_helpers/db');

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: _delete
};

const ALLOWED_TYPES = ['equipment', 'leave', 'resources'];
const ALLOWED_STATUS = ['pending', 'approved', 'disapproved', 'rejected'];

// ------------------------- Get all -------------------------
async function getAll() {
  return await db.Request.findAll({
    include: [{ model: db.Account, attributes: ['id', 'email', 'firstName', 'lastName'], required: false }],
    order: [['created', 'DESC']]
  });
}

// ------------------------- Get by requestId -------------------------
async function getById(requestId) {
  if (requestId === undefined || requestId === null) return null;
  return await db.Request.findByPk(requestId, {
    include: [{ model: db.Account, attributes: ['id', 'email', 'firstName', 'lastName'], required: false }]
  });
}

// ------------------------- Helpers -------------------------
async function resolveAccountIdFromEmail(email) {
  if (!email) return null;
  const account = await db.Account.findOne({ where: { email } });
  return account ? account.id : null;
}

// ------------------------- Create -------------------------
/**
 * params expected:
 *  { accountId?, employeeEmail?, type, items, quantity, status? }
 */
async function create(params) {
  // resolve accountId if not provided
  let accountId = params.accountId ?? null;
  if (!accountId && params.employeeEmail) {
    accountId = await resolveAccountIdFromEmail(params.employeeEmail);
  }

  if (!accountId) throw 'accountId is required';

  // validate type
  if (!ALLOWED_TYPES.includes((params.type || '').toString())) {
    throw 'Invalid request type';
  }

  // validate items and quantity
  if (!params.items || String(params.items).trim() === '') {
    throw 'items is required';
  }

  const qty = Number(params.quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    throw 'quantity must be an integer >= 1';
  }

  // validate status if present
  if (params.status && !ALLOWED_STATUS.includes(params.status)) {
    throw 'Invalid status';
  }

  const r = await db.Request.create({
    accountId,
    type: params.type,
    items: String(params.items).trim(),
    quantity: Math.trunc(qty),
    status: params.status || 'pending',
    created: new Date()
  });

  const pk = r.requestId ?? r.id ?? null;
  return await getById(pk);
}

// ------------------------- Update -------------------------
/**
 * update(requestId, params)
 * allowed fields to update: accountId, type, items, quantity, status
 */
async function update(requestId, params) {
  const request = await db.Request.findByPk(requestId);
  if (!request) throw 'Request not found';

  // If employeeEmail provided and accountId not, try to resolve
  if (!params.accountId && params.employeeEmail) {
    const resolved = await resolveAccountIdFromEmail(params.employeeEmail);
    if (resolved) params.accountId = resolved;
  }

  // If changing accountId, validate account exists
  if (params.accountId && params.accountId !== request.accountId) {
    const account = await db.Account.findByPk(params.accountId);
    if (!account) throw 'Related account not found for new accountId';
  }

  // validate type/status if present
  if (params.type && !ALLOWED_TYPES.includes(params.type)) throw 'Invalid request type';
  if (params.status && !ALLOWED_STATUS.includes(params.status)) throw 'Invalid status';

  // validate items/quantity if provided
  if (Object.prototype.hasOwnProperty.call(params, 'items')) {
    if (!params.items || String(params.items).trim() === '') {
      throw 'items cannot be empty';
    }
    request.items = String(params.items).trim();
  }

  if (Object.prototype.hasOwnProperty.call(params, 'quantity')) {
    const qty = Number(params.quantity);
    if (!Number.isFinite(qty) || qty < 1) throw 'quantity must be an integer >= 1';
    request.quantity = Math.trunc(qty);
  }

  // copy other allowed fields
  const allowed = ['accountId', 'type', 'status'];
  for (const f of allowed) {
    if (Object.prototype.hasOwnProperty.call(params, f)) {
      request[f] = params[f];
    }
  }

  request.updated = new Date();
  await request.save();

  const pk = request.requestId ?? request.id ?? null;
  return await getById(pk);
}

// ------------------------- Delete -------------------------
async function _delete(requestId) {
  const r = await db.Request.findByPk(requestId);
  if (!r) throw 'Request not found';
  await r.destroy();
}
