// src/_helpers/db.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

const configPath = path.resolve(__dirname, '..', 'config.json');
let fileConfig = {};
if (fs.existsSync(configPath)) {
  try { fileConfig = require(configPath); } catch (e) { /* ignore */ }
}

// prefer environment variables in deployment
const DB = {
  host: process.env.DB_HOST || fileConfig.database?.host || 'localhost',
  port: Number(process.env.DB_PORT || fileConfig.database?.port || 3306),
  user: process.env.DB_USER || fileConfig.database?.user || 'root',
  password: process.env.DB_PASSWORD || fileConfig.database?.password || '',
  database: process.env.DB_NAME || fileConfig.database?.database || 'node-mysql-signup-verification-api'
};

const DB_SYNC = process.env.DB_SYNC || (fileConfig.dbSync || 'alter'); // 'alter' | 'force' | 'none'
const SKIP_DB_CREATE = (process.env.SKIP_DB_CREATE || 'false').toLowerCase() === 'true';
const MAX_RETRIES = Number(process.env.DB_CONN_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.DB_CONN_RETRY_DELAY_MS || 3000);

module.exports = db = {
  sequelize: null,
  Sequelize
};

(async function initialize() {
  if (!DB.host || !DB.user || !DB.database) {
    console.error('[DB] Missing DB configuration. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.');
    // fail fast
    process.exit(1);
  }

  // Retry loop for initial connection (mysql2 createConnection)
  let attempt = 0;
  let createdConn = null;
  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      createdConn = await mysql.createConnection({ host: DB.host, port: DB.port, user: DB.user, password: DB.password });
      break;
    } catch (err) {
      console.warn(`[DB] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.code || err.message}`);
      if (attempt >= MAX_RETRIES) {
        console.error('[DB] Max connection attempts reached - aborting startup.');
        console.error(err);
        process.exit(1);
      }
      // wait then retry
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  // Optionally ensure DB exists (skip if SKIP_DB_CREATE)
  try {
    if (!SKIP_DB_CREATE) {
      await createdConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB.database}\`;`);
      console.info(`[DB] Ensured database "${DB.database}" exists.`);
    } else {
      console.info('[DB] SKIP_DB_CREATE is true — skipping CREATE DATABASE step.');
    }
  } catch (err) {
    console.error('[DB] Error ensuring database exists:', err);
    await createdConn.end().catch(()=>{});
    process.exit(1);
  } finally {
    if (createdConn) await createdConn.end().catch(()=>{});
  }

  // Initialize Sequelize
  const sequelize = new Sequelize(DB.database, DB.user, DB.password, {
    host: DB.host,
    port: DB.port,
    dialect: 'mysql',
    logging: (msg) => {
      // adjust as needed
      if (process.env.NODE_ENV === 'production') return; // silence SQL in prod
      console.debug('[sequelize]', msg);
    },
    define: { timestamps: false },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
  });

  db.sequelize = sequelize;

  // Import models (adjust paths if your tree differs)
  try {
    db.Account = require(path.resolve(__dirname, '..', 'accounts', 'account.model.js'))(sequelize);
    db.RefreshToken = require(path.resolve(__dirname, '..', 'accounts', 'refresh-token.model.js'))(sequelize);
    db.Employee = require(path.resolve(__dirname, '..', 'employees', 'employee.model.js'))(sequelize);
    db.Department = require(path.resolve(__dirname, '..', 'departments', 'department.model.js'))(sequelize);
    // NOTE: folder is 'requests' lowercased. Update path if yours differs.
    db.Request = require(path.resolve(__dirname, '..', 'requests', 'request.model.js'))(sequelize);
    db.Workflow = require(path.resolve(__dirname, '..', 'workflows', 'workflow.model.js'))(sequelize);
  } catch (err) {
    console.error('[DB] Failed to load models:', err);
    process.exit(1);
  }

  // call associate if present
  Object.keys(db).forEach(k => {
    const m = db[k];
    if (m && typeof m.associate === 'function') {
      try { m.associate(db); } catch (e) { console.warn(`[DB] associate() failed for ${k}: ${e.message}`); }
    }
  });

  // define explicit associations (safe guard)
  if (db.Account && db.RefreshToken) {
    db.Account.hasMany(db.RefreshToken, { foreignKey: 'accountId', onDelete: 'CASCADE' });
    db.RefreshToken.belongsTo(db.Account, { foreignKey: 'accountId' });
  }
  if (db.Account && db.Employee) {
    db.Account.hasOne(db.Employee, { foreignKey: 'accountId', onDelete: 'CASCADE' });
    db.Employee.belongsTo(db.Account, { foreignKey: 'accountId' });
  }
  if (db.Department && db.Employee) {
    db.Department.hasMany(db.Employee, { foreignKey: 'departmentId', sourceKey: 'id', onDelete: 'SET NULL' });
    db.Employee.belongsTo(db.Department, { foreignKey: 'departmentId', targetKey: 'id' });
  }
  if (db.Account && db.Request) {
    db.Account.hasMany(db.Request, { foreignKey: 'accountId', onDelete: 'CASCADE' });
    db.Request.belongsTo(db.Account, { foreignKey: 'accountId' });
  }
  if (db.Employee && db.Workflow) {
    db.Employee.hasMany(db.Workflow, { foreignKey: 'employeeId', sourceKey: 'EmployeeID', onDelete: 'CASCADE' });
    db.Workflow.belongsTo(db.Employee, { foreignKey: 'employeeId', targetKey: 'EmployeeID' });
  }

  // Sync: controlled by DB_SYNC env var
  try {
    if (DB_SYNC === 'none') {
      console.info('[DB] DB_SYNC=none — skipping sequelize.sync().');
    } else if (DB_SYNC === 'force') {
      console.warn('[DB] DB_SYNC=force — will drop and recreate tables!');
      await sequelize.sync({ force: true });
      console.info('[DB] sequelize.sync({ force: true }) completed.');
    } else {
      console.info('[DB] Running sequelize.sync({ alter: true }) to update tables to match models.');
      await sequelize.sync({ alter: true });
      console.info('[DB] sequelize.sync({ alter: true }) completed.');
    }
  } catch (err) {
    console.error('[DB] sequelize.sync failed:', err);
    process.exit(1);
  }

  console.info('[DB] Initialization finished.');
})();
