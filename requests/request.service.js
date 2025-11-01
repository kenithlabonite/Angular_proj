// requests/request.service.js
const db = require('_helpers/db');
const { Op } = require('sequelize');

module.exports = {
  getAll,                    // user's own requests (includes drafts)
  getAllVisibleToApprover,   // approver view (hides drafts)
  getById,
  create,
  update,
  delete: _delete,
};

const ALLOWED_TYPES = ['equipment', 'leave', 'resources'];
const ALLOWED_STATUS = ['draft', 'pending', 'approved', 'rejected'];

async function getAll(accountId) {
  if (!accountId) throw new Error('accountId required');

  return db.Request.findAll({
    where: { accountId },
    include: [{ model: db.Account, attributes: ['id', 'email', 'firstName', 'lastName'], required: false }],
    order: [['created', 'DESC']],
  });
}

async function getAllVisibleToApprover() {
  return db.Request.findAll({
    where: { status: { [Op.ne]: 'draft' } },
    include: [{ model: db.Account, attributes: ['id', 'email', 'firstName', 'lastName'], required: false }],
    order: [['created', 'DESC']],
  });
}

async function getById(requestId) {
  if (!requestId) return null;
  return db.Request.findByPk(requestId, {
    include: [{ model: db.Account, attributes: ['id', 'email', 'firstName', 'lastName'], required: false }],
  });
}

function normalizeItems(items) {
  if (Array.isArray(items)) {
    const stored = JSON.stringify(items);
    const desc = items.map(i => `${i.name ?? i}${i.quantity ? ` (x${i.quantity})` : ''}`).join(', ');
    return { stored, desc };
  }
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      if (Array.isArray(parsed)) return normalizeItems(parsed);
      return { stored: items, desc: String(items) };
    } catch {
      return { stored: items, desc: items };
    }
  }
  return { stored: String(items ?? ''), desc: String(items ?? '') };
}

async function create(params) {
  if (!params) throw new Error('Missing parameters');

  let accountId = params.accountId ?? null;
  if (!accountId && params.employeeEmail) {
    const account = await db.Account.findOne({ where: { email: params.employeeEmail } });
    accountId = account ? account.id : null;
  }
  if (!accountId) throw new Error('accountId is required');

  if (!ALLOWED_TYPES.includes(String(params.type))) throw new Error('Invalid request type');
  if (!params.items || String(params.items).trim() === '') throw new Error('items is required');

  const qty = Number(params.quantity ?? 1);
  if (!Number.isFinite(qty) || qty < 1) throw new Error('quantity must be >= 1');

  const status = params.status ? String(params.status) : 'draft';
  if (!ALLOWED_STATUS.includes(status)) throw new Error('Invalid status');

  const { stored, desc } = normalizeItems(params.items);

  const transaction = await db.sequelize.transaction();
  try {
    const request = await db.Request.create({
      accountId,
      type: params.type,
      items: stored,
      quantity: Math.trunc(qty),
      status,
      created: new Date(),
      updated: new Date(),
    }, { transaction });

    if (status === 'pending') {
      // create workflow entry (non-fatal)
      try {
        const account = await db.Account.findByPk(accountId);
        const employee = await db.Employee.findOne({ where: { accountId } });
        await db.Workflow.create({
          requestId: request.id,
          employeeId: employee ? employee.EmployeeID : null,
          type: `Request-${params.type}`,
          details: `${account?.firstName ?? 'Unknown'} ${account?.lastName ?? ''} requested ${Math.trunc(qty)}x ${desc}`,
          status: 'pending',
          created: new Date(),
          updated: new Date(),
        }, { transaction });
      } catch (wfErr) {
        console.error('Workflow creation failed (non-fatal):', wfErr);
      }
    }

    await transaction.commit();
    return getById(request.id);
  } catch (err) {
    await transaction.rollback();
    throw new Error(err.message ?? 'Failed to create request');
  }
}

async function update(requestId, params) {
  if (!requestId) throw new Error('requestId required');

  const request = await db.Request.findByPk(requestId);
  if (!request) throw new Error('Request not found');

  if (params.status && !ALLOWED_STATUS.includes(params.status)) throw new Error('Invalid status');

  if (request.status === 'draft') {
    if (params.type && ALLOWED_TYPES.includes(params.type)) request.type = params.type;
    if (params.items && String(params.items).trim() !== '') {
      const { stored } = normalizeItems(params.items);
      request.items = stored;
    }
    if (params.quantity) {
      const qty = Number(params.quantity);
      if (!Number.isFinite(qty) || qty < 1) throw new Error('quantity must be >= 1');
      request.quantity = Math.trunc(qty);
    }
    if (params.accountId) request.accountId = params.accountId;
  }

  if (params.status) request.status = params.status;

  request.updated = new Date();
  await request.save();

  return getById(requestId);
}

async function _delete(requestId) {
  const r = await db.Request.findByPk(requestId);
  if (!r) throw new Error('Request not found');
  await r.destroy();
}
