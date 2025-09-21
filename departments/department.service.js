// departments/department.service.js
const db = require('_helpers/db');

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: _delete
};

// ====== QUERIES ======

async function getAll() {
  const departments = await db.Department.findAll({
    include: [
      { model: db.Employee, as: 'Employees', attributes: ['EmployeeID', 'position', 'status'] }
    ],
    order: [['id', 'ASC']]
  });

  // recalc employeeCounts in case it's out of sync
  for (const dept of departments) {
    const count = dept.Employees ? dept.Employees.length : 0;
    if (dept.employeeCounts !== count) {
      dept.employeeCounts = count;
      await dept.save();
    }
  }

  return departments;
}

async function getById(id) {
  const department = await db.Department.findByPk(id, {
    include: [
      { model: db.Employee, as: 'Employees', attributes: ['EmployeeID', 'position', 'status'] }
    ]
  });
  if (!department) throw 'Department not found';

  // recalc employeeCounts if needed
  const count = department.Employees ? department.Employees.length : 0;
  if (department.employeeCounts !== count) {
    department.employeeCounts = count;
    await department.save();
  }

  return department;
}

// ====== CREATE ======

async function create(params) {
  const department = new db.Department({
    departmentName: params.departmentName,
    description: params.description || null,
    employeeCounts: 0
  });

  await department.save();
  return department;
}

// ====== UPDATE ======

async function update(id, params) {
  const department = await getById(id);
  if (!department) throw 'Department not found';

  const allowed = ['departmentName', 'description'];
  for (const f of allowed) {
    if (params[f] !== undefined) department[f] = params[f];
  }

  await department.save();
  return department;
}

// ====== DELETE ======

async function _delete(id) {
  const department = await getById(id);
  if (!department) throw 'Department not found';

  await department.destroy();
}
