// requests/request.service.js
const db = require('_helpers/db');
const { Op } = require('sequelize');

module.exports = {
  getAll,
  getAllVisibleToApprover,
  getById,
  create,
  update,
  delete: _delete,
};

const ALLOWED_TYPES = ['equipment', 'leave', 'resources'];
const ALLOWED_STATUS = ['draft', 'pending', 'approved', 'rejected'];

/**
 * Return all requests (includes drafts). Useful for admin/owner listing.
 */
async function getAll() {
  return db.Request.findAll({
    include: [{ model: db.Account, attributes: ['id', 'email', 'firstName', 'lastName'], required: false }],
    order: [['created', 'DESC']],
  });
}

/**
 * Return requests visible to approvers (hide drafts).
 */
async function getAllVisibleToApprover() {
  return db.Request.findAll({
    where: { status: { [Op.ne]: 'draft' } },
    include: [{ model: db.Account, attributes: ['id', 'email', 'firstName', 'lastName'], required: false }],
    order: [['created', 'DESC']],
  });
}

/**
 * Get request by PK with related Account information.
 * @param {number|string} requestId
 * @returns {Promise<db.Request|null>}
 */
async function getById(requestId) {
  if (!requestId) return null;
  return db.Request.findByPk(requestId, {
    include: [{ model: db.Account, attributes: ['id', 'email', 'firstName', 'lastName'], required: false }],
  });
}

/**
 * Resolve account id from an email address.
 * @param {string} email
 * @returns {Promise<number|null>}
 */
async function resolveAccountIdFromEmail(email) {
  if (!email) return null;
  const account = await db.Account.findOne({ where: { email } });
  return account ? account.id : null;
}

/**
 * Normalize items into a JSON string for storage and a readable description for workflows.
 * Accepts an array of items or a stringified JSON.
 * @param {any} items
 * @returns {{ stored: string, desc: string }}
 */
function normalizeItems(items) {
  // If items already an array
  if (Array.isArray(items)) {
    const stored = JSON.stringify(items);
    const desc = items.map(i => {
      const name = i.name ?? String(i);
      const qty = i.quantity ? ` (x${i.quantity})` : '';
      return `${name}${qty}`;
    }).join(', ');
    return { stored, desc };
  }

  // If items is a string that is JSON
  if (typeof items === 'string') {
    // try parse
    try {
      const parsed = JSON.parse(items);
      if (Array.isArray(parsed)) {
        return normalizeItems(parsed);
      }
      // not an array: store as string and return short desc
      return { stored: items, desc: String(items) };
    } catch {
      // not JSON, just store as-is
      return { stored: items, desc: items };
    }
  }

  // fallback: convert to string
  return { stored: String(items ?? ''), desc: String(items ?? '') };
}

/**
 * Create a new request. Accepts params:
 * { accountId?, employeeEmail?, type, items, quantity, status? }
 */
async function create(params) {
  // validate inputs
  if (!params) throw new Error('Missing parameters for create');

  let accountId = params.accountId ?? null;
  if (!accountId && params.employeeEmail) {
    accountId = await resolveAccountIdFromEmail(params.employeeEmail);
  }
  if (!accountId) throw new Error('accountId is required');

  if (!params.type || !ALLOWED_TYPES.includes(String(params.type))) throw new Error('Invalid request type');

  if (params.items === undefined || params.items === null || String(params.items).trim() === '') {
    throw new Error('items is required');
  }

  const qty = Number(params.quantity ?? 1);
  if (!Number.isFinite(qty) || qty < 1) throw new Error('quantity must be >= 1');

  const status = params.status ? String(params.status) : 'draft';
  if (!ALLOWED_STATUS.includes(status)) throw new Error('Invalid status');

  const { stored: storedItems, desc: itemDesc } = normalizeItems(params.items);

  // Use transaction so request + workflow creation are atomic.
  const transaction = await db.sequelize.transaction();
  try {
    const request = await db.Request.create({
      accountId,
      type: params.type,
      items: storedItems,
      quantity: Math.trunc(qty),
      status,
      created: new Date(),
      updated: new Date(),
    }, { transaction });

    // create workflow only for pending requests
    if (status === 'pending') {
      try {
        await createWorkflowForPending(request.id, accountId, {
          ...params,
          itemsStored: storedItems,
          itemDesc,
          quantity: Math.trunc(qty)
        }, transaction);
      } catch (wfErr) {
        // Log and continue — workflow failure should not prevent request creation in many cases,
        // but keep the transaction consistent by rolling back if you prefer. Here we log and continue.
        console.error('Failed to create workflow (non-fatal):', wfErr);
      }
    }

    await transaction.commit();
    // return fully populated request
    return getById(request.id);
  } catch (err) {
    await transaction.rollback();
    // propagate a real Error
    throw new Error(err.message ?? 'Failed to create request');
  }
}

/**
 * Create a workflow entry for a pending request.
 * If a transaction is supplied, the workflow creation will use it.
 * @param {number} requestId
 * @param {number} accountId
 * @param {object} params
 * @param {object} [transaction]
 */
async function createWorkflowForPending(requestId, accountId, params = {}, transaction = null) {
  try {
    const account = await db.Account.findByPk(accountId);
    const employee = await db.Employee.findOne({ where: { accountId } });

    // build readable description
    const itemDesc = params.itemDesc ?? (Array.isArray(params.items) ? params.items.map(i => `${i.name}${i.quantity ? ` (x${i.quantity})` : ''}`).join(', ') : (params.itemsStored ?? String(params.items ?? '')));

    await db.Workflow.create({
      requestId,
      employeeId: employee ? employee.EmployeeID : null,
      type: `Request-${params.type ?? 'unknown'}`,
      details: `${account ? `${account.firstName} ${account.lastName}` : 'Unknown'} requested ${params.quantity ?? ''}${itemDesc ? `: ${itemDesc}` : ''}`,
      status: 'pending',
      created: new Date(),
      updated: new Date(),
    }, transaction ? { transaction } : {});
  } catch (err) {
    // Bubble up error so caller can decide what to do (or swallow as in create())
    throw err;
  }
}

/**
 * Update an existing request. Only certain fields are allowed.
 * Note: business rules (who can update what) should be enforced at controller layer.
 * @param {number|string} requestId
 * @param {object} params
 */
async function update(requestId, params) {
  if (!requestId) throw new Error('requestId is required');
  if (!params || Object.keys(params).length === 0) throw new Error('No update parameters provided');

  const request = await db.Request.findByPk(requestId);
  if (!request) throw new Error('Request not found');

  if (params.status && !ALLOWED_STATUS.includes(params.status)) throw new Error('Invalid status');

  // If request is draft, allow editing of type/items/quantity/accountId
  if (request.status === 'draft') {
    if (params.type && ALLOWED_TYPES.includes(params.type)) request.type = params.type;
    if (Object.prototype.hasOwnProperty.call(params, 'items') && String(params.items).trim() !== '') {
      const { stored } = normalizeItems(params.items);
      request.items = stored;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'quantity')) {
      const qty = Number(params.quantity);
      if (!Number.isFinite(qty) || qty < 1) throw new Error('quantity must be >= 1');
      request.quantity = Math.trunc(qty);
    }
    if (params.accountId) request.accountId = params.accountId;
  }

  // allow status change (controllers should enforce permissions)
  if (params.status) request.status = params.status;

  request.updated = new Date();
  await request.save();

  return getById(requestId);
}

/**
 * Permanently delete the request by id.
 * Throws if request does not exist.
 * @param {number|string} requestId
 */
async function _delete(requestId) {
  if (!requestId) throw new Error('requestId is required');
  const r = await db.Request.findByPk(requestId);
  if (!r) throw new Error('Request not found');
  await r.destroy();
}
