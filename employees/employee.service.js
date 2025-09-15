const db = require('_helpers/db');
const { Op } = require('sequelize');

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: _delete
};

// return all employees and include associated account (so frontend shows email)
async function getAll() {
  return await db.Employee.findAll({ include: db.Account });
}

async function getById(id) {
  return await db.Employee.findByPk(id, { include: db.Account });
}

// Create employee - generate EmployeeID if not provided, ensure email linked to existing account
async function create(params) {
  // validate account exists
  const account = await db.Account.findOne({ where: { email: params.email } });
  if (!account) throw 'Related account not found for email';

  // generate EmployeeID like EMP001, EMP002 ... based on count (simple)//
  const count = await db.Employee.count();
  const next = count + 1;
  const EmployeeID = params.EmployeeID ? params.EmployeeID : `EMP${String(next).padStart(3, '0')}`;

  // avoid duplicate EmployeeID
  if (await db.Employee.findByPk(EmployeeID)) {
    throw `EmployeeID ${EmployeeID} is already exists`;
  }


  const employee = new db.Employee({
    EmployeeID,
    email: params.email,
    position: params.position,
    department: params.department,
    hireDate: params.hireDate || null,
    status: params.status || 'Active',
    created: new Date()
  });

  await employee.save();
  return await getById(EmployeeID);
}

async function update(id, params) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';

  // if email changed, ensure target account exists
  if (params.email && params.email !== employee.email) {
    const account = await db.Account.findOne({ where: { email: params.email } });
    if (!account) throw 'Related account not found for new email';
  }

  // copy allowed fields only
  const allowed = ['email', 'position', 'department', 'hireDate', 'status'];
  for (const f of allowed) {
    if (Object.prototype.hasOwnProperty.call(params, f)) employee[f] = params[f];
  }

  employee.updated = new Date();
  await employee.save();
  return await getById(employee.EmployeeID);
} 

async function _delete(id) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';
  await employee.destroy();
}

