// employees/employee.service.js
const db = require('_helpers/db');

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: _delete
};

// ------------------------- Queries -------------------------

// return all employees, include linked account (for email display)
async function getAll() {
  return await db.Employee.findAll({ include: db.Account });
}

async function getById(id) {
  return await db.Employee.findByPk(id, { include: db.Account });
}

// ------------------------- Create -------------------------

async function create(params) {
  // validate account exists
  const account = await db.Account.findByPk(params.accountId);
  if (!account) throw 'Related account not found for given accountId';

  // generate EmployeeID if not provided
  const count = await db.Employee.count();
  const next = count + 1;
  const EmployeeID = params.EmployeeID
    ? params.EmployeeID
    : `EMP${String(next).padStart(3, '0')}`;

  if (await db.Employee.findByPk(EmployeeID)) {
    throw `EmployeeID ${EmployeeID} already exists`;
  }

  const employee = new db.Employee({
    EmployeeID,
    accountId: params.accountId,
    position: params.position || null,
    department: params.department || null,
    hireDate: params.hireDate || null,
    status: params.status || 'active',
    created: new Date()
  });

  await employee.save();
  return await getById(EmployeeID);
}

// ------------------------- Update -------------------------

async function update(id, params) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';

  // if accountId changed, ensure target account exists
  if (params.accountId && params.accountId !== employee.accountId) {
    const account = await db.Account.findByPk(params.accountId);
    if (!account) throw 'Related account not found for new accountId';
  }

  // only allow certain fields to be updated
  const allowed = ['accountId', 'position', 'department', 'hireDate', 'status'];
  for (const f of allowed) {
    if (Object.prototype.hasOwnProperty.call(params, f)) {
      employee[f] = params[f];
    }
  }

  employee.updated = new Date();
  await employee.save();
  return await getById(employee.EmployeeID);
}

// ------------------------- Delete -------------------------

async function _delete(id) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';
  await employee.destroy();
}
