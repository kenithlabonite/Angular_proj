// workflows/workflow.service.js
const db = require('_helpers/db');

module.exports = {
  create,
  getAll,
  getById,
  update,
  approve,
  reject
};

// ====== CREATE ======
async function create(params) {
  // ensure employee exists
  const employee = await db.Employee.findByPk(params.employeeId, {
    include: [{ model: db.Department, as: 'Department' }]
  });
  if (!employee) throw `Employee ${params.employeeId} not found`;

  // build readable details string
  let details = '';
  switch (params.type) {
    case 'Onboarding':
      details = `Onboarded to ${employee.Department ? employee.Department.departmentName : 'No Department'} as ${employee.position || 'Unassigned'} on ${employee.hireDate || 'N/A'}`;
      break;

    case 'Department Transfer':
      details = `From: ${params.fromDepartmentName || 'N/A'} → To: ${params.toDepartmentName || 'N/A'}`;
      break;

    case 'Employee Updated':
      details = params.changes
        ? `Updated fields: ${Object.keys(params.changes).join(', ')}`
        : 'Employee information updated';
      break;

    case 'Employee Deleted':
      details = `Removed from ${params.departmentName || 'No Department'}`;
      break;

    default:
      details = params.details || 'General workflow logged';
      break;
  }

  return await db.Workflow.create({
    employeeId: params.employeeId,
    type: params.type || 'General',
    details,
    status: params.status || 'pending'
  });
}

// ====== GET ALL (optional filter by employeeId) ======
async function getAll(employeeId) {
  const where = {};
  if (employeeId) {
    where.employeeId = employeeId;
  }

  const workflows = await db.Workflow.findAll({
    where,
    include: [{ model: db.Employee }],
    order: [['createdAt', 'DESC']]
  });

  return workflows.map(wf => wf.toJSON());
}

// ====== GET BY ID ======
async function getById(id) {
  const wf = await db.Workflow.findByPk(id, {
    include: [{ model: db.Employee }]
  });
  if (!wf) throw 'Workflow not found';
  return wf.toJSON();
}

// ====== UPDATE ======
async function update(id, params) {
  const workflow = await db.Workflow.findByPk(id);
  if (!workflow) throw 'Workflow not found';

  Object.assign(workflow, params);
  await workflow.save();
  return workflow.toJSON();
}

// ====== APPROVE ======
async function approve(id) {
  const workflow = await db.Workflow.findByPk(id);
  if (!workflow) throw 'Workflow not found';

  workflow.status = 'approved';
  await workflow.save();
  return workflow.toJSON();
}

// ====== REJECT ======
async function reject(id) {
  const workflow = await db.Workflow.findByPk(id);
  if (!workflow) throw 'Workflow not found';

  workflow.status = 'rejected';
  await workflow.save();
  return workflow.toJSON();
}
