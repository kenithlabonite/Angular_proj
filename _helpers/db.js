// src/_helpers/db.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

// load config (explicit .json so it's clear)
const config = require(path.resolve(__dirname, '..', 'config.json'));

module.exports = db = {
  sequelize: null,
  Sequelize
};

initialize().catch(err => {
  console.error('Failed to initialize DB:', err);
  // make failure obvious in dev
  process.exit(1);
});

async function initialize() {
  const dbCfg = config.database || {};
  const { host, port = 3306, user, password, database } = dbCfg;

  if (!host || !user || !database) {
    throw new Error('Missing database configuration in config.json');
  }

  // 1) Ensure database exists
  const createConn = await mysql.createConnection({ host, port, user, password });
  try {
    // Use backticks/escaping for database name
    await createConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    console.info(`[DB] Ensured database "${database}" exists.`);
  } finally {
    await createConn.end();
  }

  // 2) Initialize Sequelize
  const sequelize = new Sequelize(database, user, password, {
    host,
    port,
    dialect: 'mysql',
    logging: msg => {
      // toggle or pipe to console.debug for SQL debugging
      // set to false to silence SQL logs
      console.debug('[sequelize]', msg);
    },
    define: {
      // default global model options: we will set per-model options in model files
      timestamps: false,
      underscored: false
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
  });

  db.sequelize = sequelize;

  // 3) Import models (explicit paths - match your project structure)
  // Ensure file paths are lowercased to match real folders
  try {
    db.Account = require(path.resolve(__dirname, '..', 'accounts', 'account.model.js'))(sequelize);
    db.RefreshToken = require(path.resolve(__dirname, '..', 'accounts', 'refresh-token.model.js'))(sequelize);
  } catch (e) {
    console.warn('[DB] Failed to load account models:', e.message || e);
    throw e;
  }

  try {
    db.Employee = require(path.resolve(__dirname, '..', 'employees', 'employee.model.js'))(sequelize);
    db.Department = require(path.resolve(__dirname, '..', 'departments', 'department.model.js'))(sequelize);
    db.Request = require(path.resolve(__dirname, '..', 'requests', 'request.model.js'))(sequelize);
    db.Workflow = require(path.resolve(__dirname, '..', 'workflows', 'workflow.model.js'))(sequelize);
  } catch (e) {
    console.warn('[DB] Failed to load one or more models:', e.message || e);
    throw e;
  }

  // 4) Call model.associate if present (lets each model define relationships)
  Object.keys(db).forEach(key => {
    const model = db[key];
    if (model && typeof model.associate === 'function') {
      try {
        model.associate(db);
      } catch (err) {
        console.warn(`[DB] model.associate failed for ${key}:`, err.message || err);
      }
    }
  });

  // 5) Define/ensure any additional associations (explicit for clarity / compatibility)
  // Account <-> RefreshToken (1 -> many)
  if (db.Account && db.RefreshToken) {
    db.Account.hasMany(db.RefreshToken, { foreignKey: 'accountId', onDelete: 'CASCADE' });
    db.RefreshToken.belongsTo(db.Account, { foreignKey: 'accountId' });
  }

  // Account <-> Employee (1 -> 1)
  if (db.Account && db.Employee) {
    db.Account.hasOne(db.Employee, { foreignKey: 'accountId', onDelete: 'CASCADE' });
    db.Employee.belongsTo(db.Account, { foreignKey: 'accountId' });
  }

  // Department <-> Employee (1 -> many)
  // Use attribute name 'departmentId' (Employee model defines departmentId with field 'DepartmentID')
  if (db.Department && db.Employee) {
    db.Department.hasMany(db.Employee, { foreignKey: 'departmentId', sourceKey: 'id', onDelete: 'SET NULL' });
    db.Employee.belongsTo(db.Department, { foreignKey: 'departmentId', targetKey: 'id' });
  }

  // Account <-> Request (1 -> many)
  if (db.Account && db.Request) {
    db.Account.hasMany(db.Request, { foreignKey: 'accountId', onDelete: 'CASCADE' });
    db.Request.belongsTo(db.Account, { foreignKey: 'accountId' });
  }

  // Employee <-> Workflow (1 -> many) — Employee PK is EmployeeID
  if (db.Employee && db.Workflow) {
    db.Employee.hasMany(db.Workflow, { foreignKey: 'employeeId', sourceKey: 'EmployeeID', onDelete: 'CASCADE' });
    db.Workflow.belongsTo(db.Employee, { foreignKey: 'employeeId', targetKey: 'EmployeeID' });
  }

  // 6) Sync DB schema
  try {
    console.info('[DB] Syncing models to database with sequelize.sync({ alter: true }) ...');
    // NOTE: alter:true will attempt to adjust existing tables to match models (safe-ish for dev)
    await sequelize.sync({ alter: true });
    console.info('[DB] Sequelize sync completed.');
  } catch (syncErr) {
    console.error('[DB] Sequelize sync failed:', syncErr);
    throw syncErr;
  }
}
