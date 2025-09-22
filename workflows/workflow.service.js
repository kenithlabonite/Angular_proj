const db = require('../_helpers/db');

async function create(params) {
  return await db.Workflow.create(params);
}

async function getAll() {
  return await db.Workflow.findAll();
}

async function getById(id) {
  return await getWorkflow(id);
}

async function update(id, params) {
  const workflow = await getWorkflow(id);
  Object.assign(workflow, params);
  await workflow.save();
  return workflow;
}

async function approve(id) {
  const workflow = await getWorkflow(id);
  workflow.status = 'approved';
  await workflow.save();
  return workflow;
}

async function reject(id) {
  const workflow = await getWorkflow(id);
  workflow.status = 'rejected';
  await workflow.save();
  return workflow;
}

async function getWorkflow(id) {
  const wf = await db.Workflow.findByPk(id);
  if (!wf) throw new Error('Workflow not found');
  return wf;
}

module.exports = {
  create,
  getAll,
  getById,
  update,
  approve,
  reject
};
