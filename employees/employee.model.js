// employees/employee.model.js
const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
  const attributes = {
    EmployeeID: { type: DataTypes.STRING(55), primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false },
    position: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.STRING, allowNull: false },
    hireDate: { type: DataTypes.DATE, allowNull: true },
    /* status: { type: DataTypes.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' }, */
    created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated: { type: DataTypes.DATE }
  };

  const options = { timestamps: false };

  return sequelize.define('employee', attributes, options);
}

