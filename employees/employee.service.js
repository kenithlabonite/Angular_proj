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
const Op = db.Sequelize.Op;

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
    const m = String(last.EmployeeID).match(/EMP0*([0-9]+)$/i);
    nextNum = m && m[1] ? parseInt(m[1], 10) + 1 : (await db.Employee.count()) + 1;
  }
  return `EMP${String(nextNum).padStart(3, '0')}`;
}

async function resolveAccount(params) {
  if (params.accountId) {
    const a = await db.Account.findByPk(params.accountId);
    if (!a) throw 'Account not found';
    return a;
  }
  if (params.email) {
    const a = await db.Account.findOne({ where: { email: params.email } });
    if (!a) throw 'Account not found';
    return a;
  }
  throw 'Please supply accountId or email';
}

function normalizeStatus(s) {
  return s ? String(s).trim().toLowerCase() : '';
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

async function validatePosition(params) {
  if (!params || (params.positionId == null && !params.position)) return { positionId: null, positionName: null };

  if (params.positionId != null) {
    const pos = await db.Position.findByPk(params.positionId);
    if (!pos) throw 'Position not found';
    if (String(pos.status) !== 'active') throw 'Cannot assign a deactivated position';
    return { positionId: pos.id, positionName: pos.position };
  }

  const pos = await db.Position.findOne({ where: { position: params.position } });
  if (pos) {
    if (String(pos.status) !== 'active') throw 'Cannot assign a deactivated position';
    return { positionId: pos.id, positionName: pos.position };
  }

  return { positionId: null, positionName: params.position || null };
}

async function resolveManager(params) {
  if (!params || (!params.managerId && !params.managerEmployeeId)) return null;

  // managerId assumed to be EmployeeID (like 'EMP001') or numeric PK; try both
  if (params.managerId) {
    // try find by primary key
    let m = await db.Employee.findByPk(params.managerId);
    if (m) return m;
    // try find by EmployeeID string column
    m = await db.Employee.findOne({ where: { EmployeeID: params.managerId } });
    if (m) return m;
  }

  if (params.managerEmployeeId) {
    const m2 = await db.Employee.findByPk(params.managerEmployeeId);
    if (m2) return m2;
  }

  throw 'Selected manager not found';
}

async function create(params) {
  if (!params || (!params.accountId && !params.email)) throw 'Please supply accountId or email';
  const account = await resolveAccount(params);

  const status = normalizeStatus(params.status) || 'active';
  if (!ALLOWED_STATUS.includes(status)) throw 'Invalid status';

  const existing = await db.Employee.findOne({ where: { accountId: account.id } });
  if (existing) throw 'Employee for this account already exists';

  const pos = await validatePosition(params);

  // allow only one active President
  if (pos.positionName && pos.positionName.trim().toLowerCase() === 'president') {
    const existingPresident = await db.Employee.findOne({
      where: db.sequelize.and(
        db.sequelize.where(db.sequelize.fn('lower', db.sequelize.col('position')), 'president'),
        { status: 'active' }
      )
    });
    if (existingPresident) throw 'An active President already exists';
  }

  // resolve manager (optional)
  let manager = null;
  if (params.managerId) {
    manager = await resolveManager(params);
    if (!manager) throw 'Manager not found';
  }

  const base = {
    accountId: account.id,
    position: pos.positionName,
    positionId: pos.positionId,
    managerId: manager ? manager.EmployeeID || manager.id : null, // store EmployeeID string if present
    departmentId: params.departmentId || null,
    hireDate: params.hireDate || null,
    status,
    created: new Date()
  };

  const EmployeeID = params.EmployeeID || (await generateNextEmployeeID());
  const employee = await db.Employee.create({ ...base, EmployeeID });

  if (employee.departmentId) await updateDepartmentCount(employee.departmentId);

  try {
    const dept = employee.departmentId ? await db.Department.findByPk(employee.departmentId) : null;
    await db.Workflow.create({
      employeeId: employee.EmployeeID,
      type: 'Onboarding',
      details: `Onboarded to ${dept ? dept.departmentName : 'No Department'} as ${employee.position || 'Unassigned'} on ${employee.hireDate || 'N/A'}`,
      status: 'pending'
    });
  } catch (e) {
    console.error('Workflow error:', e);
  }

  try {
    if (pos.positionName && pos.positionName.trim().toLowerCase() === 'president' && pos.positionId) {
      await db.Position.update({ status: 'deactive' }, { where: { id: pos.positionId } });
    }
  } catch (e) {
    console.error('Failed to deactivate position record for President:', e);
  }

  return await getById(employee.EmployeeID);
}

async function update(id, params) {
  const employee = await db.Employee.findByPk(id);
  if (!employee) throw 'Employee not found';

  // capture old values
  const oldValues = {
    accountId: employee.accountId,
    positionId: employee.positionId,
    position: employee.position,
    departmentId: employee.departmentId,
    hireDate: employee.hireDate ? employee.hireDate.toString() : null,
    status: employee.status,
    managerId: employee.managerId
  };

  // account change
  if (params.accountId && params.accountId !== employee.accountId) {
    const account = await db.Account.findByPk(params.accountId);
    if (!account) throw 'Related account not found for new accountId';
    const duplicate = await db.Employee.findOne({ where: { accountId: params.accountId } });
    if (duplicate && String(duplicate.EmployeeID) !== String(id)) throw 'Employee for this account already exists';
    employee.accountId = params.accountId;
  }

  // status
  if (Object.prototype.hasOwnProperty.call(params, 'status')) {
    const s = normalizeStatus(params.status);
    if (!ALLOWED_STATUS.includes(s)) throw 'Invalid status';
    employee.status = s;
  }

  // position
  if (Object.prototype.hasOwnProperty.call(params, 'positionId') || Object.prototype.hasOwnProperty.call(params, 'position')) {
    const pos = await validatePosition(params);
    const prospectiveStatus = Object.prototype.hasOwnProperty.call(params, 'status') ? normalizeStatus(params.status) : employee.status;

    if (pos.positionName && pos.positionName.trim().toLowerCase() === 'president' && prospectiveStatus === 'active') {
      const found = await db.Employee.findOne({
        where: db.sequelize.and(
          db.sequelize.where(db.sequelize.fn('lower', db.sequelize.col('position')), 'president'),
          { status: 'active' },
          { EmployeeID: { [Op.ne]: employee.EmployeeID } }
        )
      });
      if (found) throw 'An active President already exists';
    }

    employee.positionId = pos.positionId;
    employee.position = pos.positionName;
  }

  // manager
  if (Object.prototype.hasOwnProperty.call(params, 'managerId')) {
    if (params.managerId == null || params.managerId === '') {
      employee.managerId = null;
    } else {
      const manager = await resolveManager({ managerId: params.managerId });
      if (!manager) throw 'Manager not found';
      if (String(manager.EmployeeID || manager.id) === String(employee.EmployeeID || employee.id)) throw 'Employee cannot be their own manager';
      employee.managerId = manager.EmployeeID || manager.id;
    }
  }

  // department & hireDate
  if (Object.prototype.hasOwnProperty.call(params, 'departmentId')) employee.departmentId = params.departmentId;
  if (Object.prototype.hasOwnProperty.call(params, 'hireDate')) employee.hireDate = params.hireDate;

  employee.updated = new Date();
  await employee.save();

  // president auto-deactivate
  try {
    if (employee.position && employee.position.trim().toLowerCase() === 'president' && employee.positionId) {
      await db.Position.update({ status: 'deactive' }, { where: { id: employee.positionId } });
    }
  } catch (e) {
    console.error('Failed to deactivate position record for President on update:', e);
  }

  // reactivate old president position if vacated
  try {
    const oldWasPresident = oldValues.position && oldValues.position.trim().toLowerCase() === 'president';
    if (oldWasPresident) {
      const other = await db.Employee.findOne({
        where: db.sequelize.and(
          db.sequelize.where(db.sequelize.fn('lower', db.sequelize.col('position')), 'president'),
          { status: 'active' },
          { EmployeeID: { [Op.ne]: employee.EmployeeID } }
        )
      });
      if (!other) {
        if (oldValues.positionId) {
          await db.Position.update({ status: 'active' }, { where: { id: oldValues.positionId } });
        } else if (oldValues.position) {
          const p = await db.Position.findOne({ where: { position: oldValues.position } });
          if (p) await p.update({ status: 'active' });
        }
      }
    }
  } catch (e) {
    console.error('Error while reactivating old President position record:', e);
  }

  // update department counts and possibly create transfer workflow (existing behavior)
  if (oldValues.departmentId && oldValues.departmentId !== employee.departmentId) {
    await updateDepartmentCount(oldValues.departmentId);
  }
  if (employee.departmentId && oldValues.departmentId !== employee.departmentId) {
    await updateDepartmentCount(employee.departmentId);
    try {
      const newDept = await db.Department.findByPk(employee.departmentId);
      const oldDept = oldValues.departmentId ? await db.Department.findByPk(oldValues.departmentId) : null;
      await db.Workflow.create({
        employeeId: employee.EmployeeID,
        type: 'Transfer',
        details: `Transferred from ${oldDept ? oldDept.departmentName : 'None'} to ${newDept ? newDept.departmentName : 'None'}`,
        status: 'pending'
      });
    } catch (e) {
      console.error('Transfer workflow error:', e);
    }
  }

  // build detailed changes list
  try {
    const changes = [];

    // account change -> show account identifiers (email or id)
    if (oldValues.accountId !== employee.accountId) {
      const oldAcc = oldValues.accountId ? await db.Account.findByPk(oldValues.accountId) : null;
      const newAcc = employee.accountId ? await db.Account.findByPk(employee.accountId) : null;
      changes.push(`account: ${oldAcc ? (oldAcc.email || oldAcc.id) : 'none'} → ${newAcc ? (newAcc.email || newAcc.id) : 'none'}`);
    }

    // position change (use names)
    if ((oldValues.position || '') !== (employee.position || '')) {
      changes.push(`position: ${oldValues.position || 'none'} → ${employee.position || 'none'}`);
    }

    // department change (resolve names)
    if (oldValues.departmentId !== employee.departmentId) {
      const oldD = oldValues.departmentId ? await db.Department.findByPk(oldValues.departmentId) : null;
      const newD = employee.departmentId ? await db.Department.findByPk(employee.departmentId) : null;
      changes.push(`department: ${oldD ? oldD.departmentName : 'none'} → ${newD ? newD.departmentName : 'none'}`);
    }

    // hireDate change
    const oldHire = oldValues.hireDate ? String(oldValues.hireDate).substring(0,10) : '';
    const newHire = employee.hireDate ? String(employee.hireDate).substring(0,10) : '';
    if (oldHire !== newHire) {
      changes.push(`hireDate: ${oldHire || 'none'} → ${newHire || 'none'}`);
    }

    // status change
    if (oldValues.status !== employee.status) {
      changes.push(`status: ${oldValues.status || 'none'} → ${employee.status || 'none'}`);
    }

    // manager change (resolve EmployeeID or id)
    if ((oldValues.managerId || null) !== (employee.managerId || null)) {
      const oldMgr = oldValues.managerId ? await db.Employee.findByPk(oldValues.managerId) : null;
      const newMgr = employee.managerId ? await db.Employee.findByPk(employee.managerId) : null;
      const oldMgrLabel = oldMgr ? (oldMgr.EmployeeID || oldMgr.id) : 'none';
      const newMgrLabel = newMgr ? (newMgr.EmployeeID || newMgr.id) : 'none';
      changes.push(`manager: ${oldMgrLabel} → ${newMgrLabel}`);
    }

    // If no tracked changes, add a generic entry
    const details = changes.length ? changes.join('; ') : 'No tracked fields changed (profile updated)';

    // create a workflow entry with the detailed changes
    await db.Workflow.create({
      employeeId: employee.EmployeeID,
      type: 'Field Updates',
      details,
      status: 'pending'
    });
  } catch (e) {
    console.error('Workflow creation error (detailed changes):', e);
  }

  return await getById(id);
}



async function _delete(id) {
  const emp = await db.Employee.findByPk(id);
  if (!emp) throw 'Employee not found';
  const deptId = emp.departmentId;
  const wasPresident = emp.position && emp.position.trim().toLowerCase() === 'president';
  const posId = emp.positionId || null;
  const posName = emp.position || null;

  await emp.destroy();
  if (deptId) await updateDepartmentCount(deptId);

  if (wasPresident) {
    const other = await db.Employee.findOne({
      where: db.sequelize.and(
        db.sequelize.where(db.sequelize.fn('lower', db.sequelize.col('position')), 'president'),
        { status: 'active' }
      )
    });
    if (!other) {
      try {
        if (posId) {
          await db.Position.update({ status: 'active' }, { where: { id: posId } });
        } else if (posName) {
          const p = await db.Position.findOne({ where: { position: posName } });
          if (p) await p.update({ status: 'active' });
        }
      } catch (e) {
        console.error('Failed to reactivate position after deleting President:', e);
      }
    }
  }
}
