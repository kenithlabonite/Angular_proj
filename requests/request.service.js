// requests/request.service.js
const db = require('_helpers/db');

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: _delete,
};

const ALLOWED_TYPES = ['equipment', 'leave', 'resources'];
const ALLOWED_STATUS = ['pending', 'approved', 'disapproved', 'rejected'];

// ------------------------- Get all -------------------------
async function getAll() {
  return await db.Request.findAll({
    include: [
      {
        model: db.Account,
        attributes: ['id', 'email', 'firstName', 'lastName'],
        required: false,
      },
    ],
    order: [['created', 'DESC']],
  });
}

// ------------------------- Get by ID -------------------------
async function getById(requestId) {
  if (requestId === undefined || requestId === null) return null;
  return await db.Request.findByPk(requestId, {
    include: [
      {
        model: db.Account,
        attributes: ['id', 'email', 'firstName', 'lastName'],
        required: false,
      },
    ],
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
  // 🔹 Resolve accountId if not provided
  let accountId = params.accountId ?? null;
  if (!accountId && params.employeeEmail) {
    accountId = await resolveAccountIdFromEmail(params.employeeEmail);
  }

  if (!accountId) throw 'accountId is required';

  // 🔹 Validate type
  if (!ALLOWED_TYPES.includes((params.type || '').toString())) {
    throw 'Invalid request type';
  }

  // 🔹 Validate items
  if (!params.items || String(params.items).trim() === '') {
    throw 'items is required';
  }

  // 🔹 Validate quantity
  const qty = Number(params.quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    throw 'quantity must be an integer >= 1';
  }

  // 🔹 Validate status if provided
  if (params.status && !ALLOWED_STATUS.includes(params.status)) {
    throw 'Invalid status';
  }

  // ✅ Create request record
  const request = await db.Request.create({
    accountId,
    type: params.type,
    items: String(params.items).trim(),
    quantity: Math.trunc(qty),
    status: params.status || 'pending',
    created: new Date(),
  });

  const requestId = request.id ?? request.requestId ?? null;

  // ✅ Automatically create a linked workflow
  try {
    const account = await db.Account.findByPk(accountId);
    const employee = await db.Employee.findOne({ where: { accountId } });

    // 🧠 Convert JSON string or array into readable text
    let itemDescription = '';
    if (Array.isArray(params.items)) {
      itemDescription = params.items
        .map(i => `${i.name}${i.quantity ? ` (x${i.quantity})` : ''}`)
        .join(', ');
    } else if (typeof params.items === 'string') {
      try {
        const parsed = JSON.parse(params.items);
        if (Array.isArray(parsed)) {
          itemDescription = parsed
            .map(i => `${i.name}${i.quantity ? ` (x${i.quantity})` : ''}`)
            .join(', ');
        } else {
          itemDescription = params.items;
        }
      } catch {
        itemDescription = params.items;
      }
    }

    const readableDetails = `${account.firstName} ${account.lastName} requested ${params.quantity}x ${itemDescription}`;

    await db.Workflow.create({
      requestId,
      employeeId: employee ? employee.EmployeeID : null,
      type: `Request-${params.type}`,
      details: readableDetails,
      status: 'pending',
    });
  } catch (err) {
    console.error('⚠️ Failed to create workflow for request:', err);
  }

  return await getById(requestId);
}

// ------------------------- Update -------------------------
async function update(requestId, params) {
  const request = await db.Request.findByPk(requestId);
  if (!request) throw 'Request not found';

  // 🔹 Resolve account if needed
  if (!params.accountId && params.employeeEmail) {
    const resolved = await resolveAccountIdFromEmail(params.employeeEmail);
    if (resolved) params.accountId = resolved;
  }

  // 🔹 Validate related account
  if (params.accountId && params.accountId !== request.accountId) {
    const account = await db.Account.findByPk(params.accountId);
    if (!account) throw 'Related account not found for new accountId';
  }

  // 🔹 Validate type/status
  if (params.type && !ALLOWED_TYPES.includes(params.type))
    throw 'Invalid request type';
  if (params.status && !ALLOWED_STATUS.includes(params.status))
    throw 'Invalid status';

  // 🔹 Validate items/quantity
  if (Object.prototype.hasOwnProperty.call(params, 'items')) {
    if (!params.items || String(params.items).trim() === '')
      throw 'items cannot be empty';
    request.items = String(params.items).trim();
  }

  if (Object.prototype.hasOwnProperty.call(params, 'quantity')) {
    const qty = Number(params.quantity);
    if (!Number.isFinite(qty) || qty < 1)
      throw 'quantity must be an integer >= 1';
    request.quantity = Math.trunc(qty);
  }

  // 🔹 Copy other allowed fields
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
