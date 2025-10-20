// src/_helpers/db.js
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { Sequelize } = require("sequelize");

const configPath = path.resolve(__dirname, "..", "config.json");
let fileConfig = {};

// 🧠 Load configuration safely
if (fs.existsSync(configPath)) {
  try {
    fileConfig = require(configPath);
  } catch (err) {
    console.warn("[DB] ⚠️ Failed to parse config.json:", err.message);
  }
}

// ⚙️ Database configuration (env > config.json > default)
const DB = {
  host: process.env.DB_HOST || fileConfig.database?.host || "localhost",
  port: Number(process.env.DB_PORT || fileConfig.database?.port || 3306),
  user: process.env.DB_USER || fileConfig.database?.user || "root",
  password: process.env.DB_PASSWORD || fileConfig.database?.password || "",
  database:
    process.env.DB_NAME ||
    fileConfig.database?.database ||
    "node-mysql-signup-verification-api",
};

// 🔄 Sync and retry settings
const DB_SYNC = (process.env.DB_SYNC || fileConfig.dbSync || "alter").toLowerCase(); // alter | force | none
const SKIP_DB_CREATE =
  (process.env.SKIP_DB_CREATE || "false").toLowerCase() === "true";
const MAX_RETRIES = Number(process.env.DB_CONN_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.DB_CONN_RETRY_DELAY_MS || 3000);

// 📦 Exportable db object
const db = { sequelize: null, Sequelize };
module.exports = db;

// 🚀 Initialize database
(async function initialize() {
  if (!DB.host || !DB.user || !DB.database) {
    console.error("[DB] ❌ Missing configuration. Check DB_HOST, DB_USER, and DB_NAME.");
    process.exit(1);
  }

  // 🔁 Retry MySQL connection
  let attempt = 0;
  let connection = null;
  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      connection = await mysql.createConnection({
        host: DB.host,
        port: DB.port,
        user: DB.user,
        password: DB.password,
      });
      console.info(`[DB] ✅ Connected to MySQL (attempt ${attempt}).`);
      break;
    } catch (err) {
      console.warn(`[DB] ⚠️ Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt >= MAX_RETRIES) {
        console.error("[DB] ❌ Max connection attempts reached. Exiting.");
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  // 🏗️ Ensure database exists
  try {
    if (!SKIP_DB_CREATE) {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB.database}\`;`);
      console.info(`[DB] 🏗️ Database "${DB.database}" ensured.`);
    } else {
      console.info("[DB] ⚙️ SKIP_DB_CREATE=true — skipping CREATE DATABASE step.");
    }
  } catch (err) {
    console.error("[DB] ❌ Failed ensuring database exists:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end().catch(() => {});
  }

  // 🔧 Initialize Sequelize ORM
  const sequelize = new Sequelize(DB.database, DB.user, DB.password, {
    host: DB.host,
    port: DB.port,
    dialect: "mysql",
    logging:
      process.env.NODE_ENV === "production"
        ? false
        : (msg) => console.debug("[sequelize]", msg),
    define: { timestamps: true },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  });

  db.sequelize = sequelize;

  // 🧩 Import models
  try {
    db.Account = require("../accounts/account.model")(sequelize);
    db.RefreshToken = require("../accounts/refresh-token.model")(sequelize);
    db.Employee = require("../employees/employee.model")(sequelize);
    db.Department = require("../departments/department.model")(sequelize);
    db.Position = require("../positions/position.model")(sequelize); // ✅ includes status field
    db.Request = require("../requests/request.model")(sequelize);
    db.Workflow = require("../workflows/workflow.model")(sequelize);
  } catch (err) {
    console.error("[DB] ❌ Failed to load models:", err);
    process.exit(1);
  }

  // 🔗 Call associate() if defined inside models
  Object.keys(db).forEach((key) => {
    const model = db[key];
    if (model?.associate) {
      try {
        model.associate(db);
      } catch (err) {
        console.warn(`[DB] ⚠️ associate() failed for ${key}: ${err.message}`);
      }
    }
  });

  // 🔐 Manual relationships (for models without associate())
  if (db.Account && db.RefreshToken) {
    db.Account.hasMany(db.RefreshToken, { foreignKey: "accountId", onDelete: "CASCADE" });
    db.RefreshToken.belongsTo(db.Account, { foreignKey: "accountId" });
  }

  if (db.Account && db.Employee) {
    db.Account.hasOne(db.Employee, { foreignKey: "accountId", onDelete: "CASCADE" });
    db.Employee.belongsTo(db.Account, { foreignKey: "accountId" });
  }

  if (db.Department && db.Employee) {
    db.Department.hasMany(db.Employee, { foreignKey: "departmentId", onDelete: "SET NULL" });
    db.Employee.belongsTo(db.Department, { foreignKey: "departmentId" });
  }

  if (db.Account && db.Request) {
    db.Account.hasMany(db.Request, { foreignKey: "accountId", onDelete: "CASCADE" });
    db.Request.belongsTo(db.Account, { foreignKey: "accountId" });
  }

  if (db.Employee && db.Workflow) {
    db.Employee.hasMany(db.Workflow, {
      foreignKey: "employeeId",
      sourceKey: "EmployeeID",
      onDelete: "CASCADE",
    });
    db.Workflow.belongsTo(db.Employee, {
      foreignKey: "employeeId",
      targetKey: "EmployeeID",
    });
  }

  if (db.Position && db.Employee) {
    db.Position.hasMany(db.Employee, { foreignKey: "positionId", onDelete: "SET NULL" });
    db.Employee.belongsTo(db.Position, { foreignKey: "positionId" });
  }

  // 🧭 Sync schema (according to DB_SYNC)
  try {
    switch (DB_SYNC) {
      case "force":
        console.warn("[DB] ⚠️ DB_SYNC=force — Dropping & recreating all tables...");
        await sequelize.sync({ force: true });
        console.info("[DB] ✅ Tables recreated successfully.");
        break;
      case "alter":
        console.info("[DB] 🔄 DB_SYNC=alter — Syncing models with database...");
        await sequelize.sync({ alter: false });
        console.info("[DB] ✅ Tables updated successfully.");
        break;
      case "none":
        console.info("[DB] 🚫 DB_SYNC=none — Skipping sync.");
        break;
      default:
        console.info(`[DB] ⚙️ Unknown DB_SYNC mode "${DB_SYNC}". Using safe mode.`);
        await sequelize.sync({ alter: false });
    }
  } catch (err) {
    console.error("[DB] ❌ sequelize.sync failed:", err);
    process.exit(1);
  }

  console.info(`[DB] ✅ Initialization complete (Mode: ${DB_SYNC.toUpperCase()})`);
})();
