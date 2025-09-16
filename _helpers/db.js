const config = require('config.json');
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

module.exports = db = {};

initialize();

async function initialize() {
    const { host, port, user, password, database } = config.database;

    // Create database if it doesn't exist
    const connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);

    // Connect with Sequelize
    const sequelize = new Sequelize(database, user, password, { dialect: 'mysql' });

    // Import models
    db.Account = require('../accounts/account.model.js')(sequelize);
    db.RefreshToken = require('../accounts/refresh-token.model.js')(sequelize);
    db.Employee = require('../employees/employee.model.js')(sequelize);

    // ----------------- Relationships -----------------

    // Account ↔ RefreshTokens (1 → many)
    db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
    db.RefreshToken.belongsTo(db.Account);

    // Account ↔ Employee (1 → 1 via EmployeeID = Account.id)
    db.Account.hasOne(db.Employee, { foreignKey: 'EmployeeID', sourceKey: 'id', onDelete: 'CASCADE' });
    db.Employee.belongsTo(db.Account, { foreignKey: 'EmployeeID', targetKey: 'id', onDelete: 'CASCADE' });

    // Sync DB
    await sequelize.sync({ alter: true }); // updates schema safely

}
