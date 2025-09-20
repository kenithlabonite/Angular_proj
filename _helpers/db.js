// src/_helpers/db.js
const config = require('config.json');
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

module.exports = db = {
  sequelize: null,
  Sequelize
};

initialize().catch(err => {
  console.error('Failed to initialize DB:', err);
  process.exit(1); // make failure obvious in dev
});

async function initialize() {
  const { host, port, user, password, database } = config.database;

  if (!host || !user || !database) {
    throw new Error('Missing database configuration in config.json');
  }

  // 1) Ensure database exists
  const createConn = await mysql.createConnection({ host, port, user, password });
  try {
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
    logging: msg => console.debug('[sequelize]', msg),
    define: { timestamps: false }, // disable default createdAt/updatedAt
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
  });

  db.sequelize = sequelize;

  // 3) Import models
  db.Account = require('../accounts/account.model.js')(sequelize);
  db.RefreshToken = require('../accounts/refresh-token.model.js')(sequelize);
  db.Employee = require('../employees/employee.model.js')(sequelize);
  db.Department = require('../departments/department.model.js')(sequelize);
  db.Request = require('../requests/request.model.js')(sequelize);

  // 4) Define associations

  // Account ↔ RefreshTokens (1 → many)
  db.Account.hasMany(db.RefreshToken, { foreignKey: 'accountId', onDelete: 'CASCADE' });
  db.RefreshToken.belongsTo(db.Account, { foreignKey: 'accountId' });

  // Account ↔ Employee (1 → 1)
  db.Account.hasOne(db.Employee, { foreignKey: 'accountId', onDelete: 'CASCADE' });
  db.Employee.belongsTo(db.Account, { foreignKey: 'accountId' });

  // Department ↔ Employee (1 → many)
  db.Department.hasMany(db.Employee, { foreignKey: 'DepartmentID', onDelete: 'SET NULL' });
  db.Employee.belongsTo(db.Department, { foreignKey: 'DepartmentID' });

  // Account ↔ Request (1 → many)
  db.Account.hasMany(db.Request, { foreignKey: 'accountId', onDelete: 'CASCADE' });
  db.Request.belongsTo(db.Account, { foreignKey: 'accountId' });

  // 5) Sync DB schema
  try {
    console.info('[DB] Syncing models to database (alter=true).');
    await sequelize.sync(); 
    console.info('[DB] Sequelize sync completed.');
  } catch (syncErr) {
    console.error('[DB] Sequelize sync failed:', syncErr);
    throw syncErr;
  }
}
