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

const ALLOWED_STATUS = ['active', 'inactive'];

// ====== QUERIES ======
async function getAll() {
  return await db.Employee.findAll({
    include: [
      { model: db.Account, as: 'Account' },
      { model: db.Department, as: 'Department', attributes: ['id', 'departmentName', 'employeeCounts'] },
      { model: db.Workflow }
    ],
    order: [['created', 'DESC']]
  });
}

async function getById(id) {
  return await db.Employee.findByPk(id, {
    include: [
      { model: db.Account, as: 'Account' },
      { model: db.Department, as: 'Department', attributes: ['id', 'departmentName', 'employeeCounts'] },
      { model: db.Workflow }
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

// ====== HELPERS ======
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

function normalizeStatus(raw) {
  const s = (raw === undefined || raw === null) ? '' : String(raw).trim().toLowerCase();
  return s;
}

async function updateDepartmentCount(departmentId) {
  if (!departmentId) return;
  const count = await db.Employee.count({ where: { departmentId } });
  const dept = await db.Department.findByPk(departmentId);
  if (dept) {
    dept.employeeCounts = count;
    await dept.save();
  }
}

// ====== CREATE ======
async function create(params) {
  if (!params || (!params.accountId && !params.email)) {
    throw 'Please supply accountId or email for related account';
  }

  const account = await resolveAccount(params);
  const incomingStatus = normalizeStatus(params.status) || 'active';
  if (!ALLOWED_STATUS.includes(incomingStatus)) throw 'Invalid status';

  // ensure one employee per account
  const existingForAccount = await db.Employee.findOne({ where: { accountId: account.id } });
  if (existingForAccount) throw 'Employee for this account already exists';

  const base = {
    accountId: account.id,
    position: params.position || null,
    departmentId: params.departmentId || null,
    hireDate: params.hireDate || null,
    status: incomingStatus,
    created: new Date()
  };

  let employee = null;
  if (params.EmployeeID) {
    employee = await db.Employee.create({ ...base, EmployeeID: params.EmployeeID });
  } else {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const candidateId = await generateNextEmployeeID();
      try {
        employee = await db.Employee.create({ ...base, EmployeeID: candidateId });
        break;
      } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError' && attempt < 5) continue;
        throw err;
      }
    }
    if (!employee) throw 'Failed to generate unique EmployeeID';
  }

  if (employee.departmentId) await updateDepartmentCount(employee.departmentId);

  // create onboarding workflow
  try {
    const dept = employee.departmentId ? await db.Department.findByPk(employee.departmentId) : null;
    await db.Workflow.create({
      employeeId: employee.EmployeeID,
      type: 'Onboarding',
      details: `Onboarded to ${dept ? dept.departmentName : 'No Department'} as ${employee.position || 'Unassigned'} on ${employee.hireDate || 'N/A'}`,
      status: 'pending'
    });
  } catch (wfErr) {
    console.error('Failed to create onboarding workflow:', wfErr);
  }

  return await getById(employee.EmployeeID);
}

// ====== UPDATE ======
async function update(id, params) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';

  const oldDeptId = employee.departmentId;

  if (params.accountId && params.accountId !== employee.accountId) {
    const account = await db.Account.findByPk(params.accountId);
    if (!account) throw 'Related account not found for new accountId';
    const duplicate = await db.Employee.findOne({ where: { accountId: params.accountId } });
    if (duplicate && String(duplicate.EmployeeID) !== String(id)) throw 'Employee for this account already exists';
    employee.accountId = params.accountId;
  }

  const allowed = ['position', 'departmentId', 'hireDate', 'status'];
  for (const f of allowed) {
    if (Object.prototype.hasOwnProperty.call(params, f)) employee[f] = params[f];
  }

  if (params.status) {
    const s = normalizeStatus(params.status);
    if (!ALLOWED_STATUS.includes(s)) throw 'Invalid status';
    employee.status = s;
  }

  employee.updated = new Date();
  await employee.save();

  // update department counts
  if (oldDeptId && oldDeptId !== employee.departmentId) {
    await updateDepartmentCount(oldDeptId);
  }
  if (employee.departmentId && oldDeptId !== employee.departmentId) {
    await updateDepartmentCount(employee.departmentId);

    // 🔥 create workflow for transfer
    try {
      const newDept = await db.Department.findByPk(employee.departmentId);
      const oldDept = oldDeptId ? await db.Department.findByPk(oldDeptId) : null;
      await db.Workflow.create({
        employeeId: employee.EmployeeID,
        type: 'Transfer',
        details: `Transferred from ${oldDept ? oldDept.departmentName : 'None'} to ${newDept ? newDept.departmentName : 'None'}`,
        status: 'pending'
      });
    } catch (wfErr) {
      console.error('Failed to create transfer workflow:', wfErr);
    }
  }

  return await getById(id);
}

// ====== DELETE ======
async function _delete(id) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';
  const deptId = employee.departmentId;
  await employee.destroy();
  if (deptId) await updateDepartmentCount(deptId);
}
