// employees/employee.service.js
const db = require('_helpers/db');

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: _delete,
  generateNextEmployeeID
};

// ====== QUERIES ======

async function getAll() {
  return await db.Employee.findAll({
    include: [
      { model: db.Account, as: 'Account' },
      { model: db.Department, as: 'Department', attributes: ['id', 'departmentName'] }
    ],
    order: [['created', 'DESC']]
  });
}

async function getById(id) {
  return await db.Employee.findByPk(id, {
    include: [
      { model: db.Account, as: 'Account' },
      { model: db.Department, as: 'Department', attributes: ['id', 'departmentName'] }
    ]
  });
}

async function generateNextEmployeeID() {
  const last = await db.Employee.findOne({ order: [['EmployeeID', 'DESC']] });
  let nextNum = 1;
  if (last && last.EmployeeID) {
    const match = String(last.EmployeeID).match(/EMP0*([0-9]+)$/i);
    if (match && match[1]) nextNum = parseInt(match[1], 10) + 1;
    else nextNum = (await db.Employee.count()) + 1;
  }
  return `EMP${String(nextNum).padStart(3, '0')}`;
}

// ====== CREATE ======

async function resolveAccount(params) {
  if (params.accountId) {
    const account = await db.Account.findByPk(params.accountId);
    if (!account) throw 'Related account not found for given accountId';
    return account;
  }
  if (params.email) {
    const account = await db.Account.findOne({ where: { email: params.email } });
    if (!account) throw 'Related account not found for given email';
    return account;
  }
  throw 'Please supply accountId or email for related account';
}

async function create(params) {
  const account = await resolveAccount(params);
  const status = (params.status || 'active').toString().toLowerCase();

  const existing = await db.Employee.findOne({ where: { accountId: account.id } });
  if (existing) throw 'Employee for this account already exists';

  const base = {
    accountId: account.id,
    position: params.position || null,
    departmentId: params.departmentId || null, // ✅ correct field
    hireDate: params.hireDate || null,
    status,
    created: new Date()
  };

  if (params.EmployeeID) {
    if (await db.Employee.findByPk(params.EmployeeID)) {
      throw `EmployeeID ${params.EmployeeID} already exists`;
    }
    const employee = new db.Employee({ ...base, EmployeeID: params.EmployeeID });
    await employee.save();
    return await getById(params.EmployeeID);
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    const candidateId = await generateNextEmployeeID();
    try {
      const employee = new db.Employee({ ...base, EmployeeID: candidateId });
      await employee.save();
      return await getById(candidateId);
    } catch (err) {
      const msg = (err && err.message ? err.message.toLowerCase() : '');
      const uniqueError =
        msg.includes('unique') ||
        msg.includes('duplicate') ||
        err.name === 'SequelizeUniqueConstraintError';
      if (uniqueError && attempt < 5) continue;
      throw err;
    }
  }
  throw 'Failed to generate unique EmployeeID after multiple attempts';
}

// ====== UPDATE ======

async function update(id, params) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';

  if (params.accountId && params.accountId !== employee.accountId) {
    const account = await db.Account.findByPk(params.accountId);
    if (!account) throw 'Related account not found for new accountId';
    const duplicate = await db.Employee.findOne({ where: { accountId: params.accountId } });
    if (duplicate) throw 'Employee for this account already exists';
    employee.accountId = params.accountId;
  }

  const allowed = ['position', 'departmentId', 'hireDate', 'status'];
  for (const f of allowed) {
    if (params[f] !== undefined) {
      employee[f] =
        f === 'status'
          ? (params[f] || 'active').toString().toLowerCase()
          : params[f];
    }
  }

  employee.updated = new Date();
  await employee.save();
  return await getById(employee.EmployeeID);
}

// ====== DELETE ======

async function _delete(id) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';
  await employee.destroy();
}
