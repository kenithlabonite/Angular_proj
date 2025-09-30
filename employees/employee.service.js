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

// ====== CREATE HELPERS ======
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
  // Count employees in the department and update department.employeeCounts
  const count = await db.Employee.count({ where: { departmentId } });
  const dept = await db.Department.findByPk(departmentId);
  if (dept) {
    dept.employeeCounts = count;
    await dept.save();
  }
}

// ====== CREATE ======
async function create(params) {
  try {
    // -- Defensive validation: require accountId or email early --
    if (!params || (!params.accountId && !params.email)) {
      throw 'Please supply accountId or email for related account';
    }

    // Debug logs (leave for now to help debugging; remove in production if noisy)
    console.log('create(employee) - incoming params:', params);

    // Resolve account (throws if not found)
    const account = await resolveAccount(params);
    console.log('create(employee) - resolved account id:', account?.id ?? null);

    const incomingStatus = normalizeStatus(params.status) || 'active';
    if (!ALLOWED_STATUS.includes(incomingStatus)) throw 'Invalid status';

    // Ensure there is no existing employee for this account
    const existingForAccount = await db.Employee.findOne({ where: { accountId: account.id } });
    if (existingForAccount) {
      // If the client provided EmployeeID and it's same account, return existing
      if (params.EmployeeID && String(existingForAccount.EmployeeID) === String(params.EmployeeID)) {
        console.log('create(employee) - employee already exists for account and EmployeeID matches; returning existing.');
        return await getById(existingForAccount.EmployeeID);
      }
      // Otherwise, it's a conflict: employee already exists for account
      throw 'Employee for this account already exists';
    }

    const base = {
      accountId: account.id,
      position: params.position || null,
      departmentId: params.departmentId || null,
      hireDate: params.hireDate || null,
      status: incomingStatus,
      created: new Date()
    };

    console.log('create(employee) - base object:', base);

    let employee = null;

    // If client provided an EmployeeID, try to create with it or return existing if found
    if (params.EmployeeID) {
      const existingById = await db.Employee.findByPk(params.EmployeeID);
      if (existingById) {
        console.log('create(employee) - EmployeeID already exists in DB; returning existing record.');
        return await getById(existingById.EmployeeID);
      }
      // Do a single create with the provided EmployeeID
      employee = await db.Employee.create({ ...base, EmployeeID: params.EmployeeID });
    } else {
      // Generate candidate EmployeeIDs and try to create (retries on unique collisions)
      for (let attempt = 1; attempt <= 5; attempt++) {
        const candidateId = await generateNextEmployeeID();
        try {
          employee = await db.Employee.create({ ...base, EmployeeID: candidateId });
          break; // success
        } catch (err) {
          const msg = (err && err.message ? err.message.toLowerCase() : '');
          const uniqueError =
            msg.includes('unique') ||
            msg.includes('duplicate') ||
            err.name === 'SequelizeUniqueConstraintError';
          if (uniqueError && attempt < 5) {
            console.warn(`create(employee) - EmployeeID collision for ${candidateId}, retrying...`);
            continue;
          }
          throw err;
        }
      }
      if (!employee) throw 'Failed to generate unique EmployeeID';
    }

    // Log final state
    console.log('create(employee) - saved employee:', employee.EmployeeID || employee.id, 'accountId:', employee.accountId);

    // update department counts if assigned
    if (employee.departmentId) {
      await updateDepartmentCount(employee.departmentId);
    }

    // create onboarding workflow record (best-effort)
    try {
      const dept = employee.departmentId ? await db.Department.findByPk(employee.departmentId) : null;
      await db.Workflow.create({
        employeeId: employee.EmployeeID,
        type: 'Onboarding',
        details: `Onboarded to ${dept ? dept.departmentName : 'No Department'} as ${employee.position || 'Unassigned'} on ${employee.hireDate || 'N/A'}`,
        status: 'pending'
      });
    } catch (wfErr) {
      // workflow creation should not block employee creation — log and continue
      console.error('Failed to create onboarding workflow:', wfErr);
    }

    return await getById(employee.EmployeeID);
  } catch (err) {
    console.error('Error in create:', err);
    throw err;
  }
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
    if (Object.prototype.hasOwnProperty.call(params, f)) employee[f] = params[f];
  }

  // status validation
  if (params.status) {
    const s = normalizeStatus(params.status);
    if (!ALLOWED_STATUS.includes(s)) throw 'Invalid status';
    employee.status = s;
  }

  employee.updated = new Date();
  await employee.save();

  // update department counts if department changed
  if (oldDeptId && oldDeptId !== employee.departmentId) {
    await updateDepartmentCount(oldDeptId);
  }
  if (employee.departmentId && oldDeptId !== employee.departmentId) {
    await updateDepartmentCount(employee.departmentId);
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
