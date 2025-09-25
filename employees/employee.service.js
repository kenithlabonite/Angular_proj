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

function normalizeStatus(raw) {
  const s = (raw === undefined || raw === null) ? '' : String(raw).trim().toLowerCase();
  return s;
}

async function create(params) {
  const account = await resolveAccount(params);

  const incomingStatus = normalizeStatus(params.status) || 'active';
  if (!ALLOWED_STATUS.includes(incomingStatus)) throw 'Invalid status';

  const existing = await db.Employee.findOne({ where: { accountId: account.id } });
  if (existing) throw 'Employee for this account already exists';

  const base = {
    accountId: account.id,
    position: params.position || null,
    departmentId: params.departmentId || null,
    hireDate: params.hireDate || null,
    status: incomingStatus,
    created: new Date()
  };

  let employee;
  if (params.EmployeeID) {
    if (await db.Employee.findByPk(params.EmployeeID)) {
      throw `EmployeeID ${params.EmployeeID} already exists`;
    }
    employee = new db.Employee({ ...base, EmployeeID: params.EmployeeID });
    await employee.save();
  } else {
    // try to generate unique EmployeeID a few times
    for (let attempt = 1; attempt <= 5; attempt++) {
      const candidateId = await generateNextEmployeeID();
      try {
        employee = new db.Employee({ ...base, EmployeeID: candidateId });
        await employee.save();
        break;
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
    if (!employee) throw 'Failed to generate unique EmployeeID';
  }

  if (employee.departmentId) await updateDepartmentCount(employee.departmentId);

  const dept = employee.departmentId ? await db.Department.findByPk(employee.departmentId) : null;
  await db.Workflow.create({
    employeeId: employee.EmployeeID,
    type: 'Onboarding',
    details: `Onboarded to ${dept ? dept.departmentName : 'No Department'} as ${employee.position || 'Unassigned'} on ${employee.hireDate || 'N/A'}`,
    status: 'pending' // ✅ fits enum
  });

  return await getById(employee.EmployeeID);
}

// ====== UPDATE ======
async function update(id, params) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';

  const oldDeptId = employee.departmentId;
  const oldDept = oldDeptId ? await db.Department.findByPk(oldDeptId) : null;

  if (params.accountId && params.accountId !== employee.accountId) {
    const account = await db.Account.findByPk(params.accountId);
    if (!account) throw 'Related account not found for new accountId';
    const duplicate = await db.Employee.findOne({ where: { accountId: params.accountId } });
    if (duplicate && String(duplicate.EmployeeID) !== String(id)) throw 'Employee for this account already exists';
    employee.accountId = params.accountId;
  }

  const allowed = ['position', 'departmentId', 'hireDate', 'status'];
  for (const f of allowed) {
    if (Object.prototype.hasOwnProperty.call(params, f)) {
      if (f === 'status') {
        const normalized = normalizeStatus(params[f]);
        if (!normalized) throw 'status cannot be empty';
        if (!ALLOWED_STATUS.includes(normalized)) throw 'Invalid status';
        employee.status = normalized;
      } else {
        employee[f] = params[f] === undefined ? employee[f] : params[f];
      }
    }
  }

  await employee.save();

  if (Object.prototype.hasOwnProperty.call(params, 'departmentId') && params.departmentId !== oldDeptId) {
    if (oldDeptId) await updateDepartmentCount(oldDeptId);
    if (employee.departmentId) await updateDepartmentCount(employee.departmentId);

    const newDept = employee.departmentId ? await db.Department.findByPk(employee.departmentId) : null;
    await db.Workflow.create({
      employeeId: employee.EmployeeID,
      type: 'Department Transfer',
      details: `From: ${oldDept ? oldDept.departmentName : 'N/A'} → To: ${newDept ? newDept.departmentName : 'N/A'}`,
      status: 'pending' // ✅ fits enum
    });
  } else if (Object.prototype.hasOwnProperty.call(params, 'departmentId')) {
    if (employee.departmentId) await updateDepartmentCount(employee.departmentId);
  }

  /* await db.Workflow.create({
    employeeId: employee.EmployeeID,
    type: 'Employee Updated',
    details: `Updated fields: ${Object.keys(params).join(', ')}`,
    status: 'approved' // ✅ fits enum
  }); */

  return await getById(employee.EmployeeID);
}

// ====== DELETE ======
async function _delete(id) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';

  const dept = employee.departmentId ? await db.Department.findByPk(employee.departmentId) : null;

  await db.Workflow.create({
    employeeId: employee.EmployeeID,
    type: 'Employee Deleted',
    details: `Removed from ${dept ? dept.departmentName : 'No Department'}`,
    status: 'rejected' // ✅ fits enum
  });

  await employee.destroy();

  if (dept) await updateDepartmentCount(dept.id);
}

// ====== HELPER ======
async function updateDepartmentCount(departmentId) {
  if (!departmentId) return;
  const count = await db.Employee.count({ where: { departmentId } });
  await db.Department.update(
    { employeeCounts: count },
    { where: { id: departmentId } }
  );
}
