// src/models/workflow.model.js
// Sequelize model for Workflows
// Adjust the employeeId type below to match Employees.EmployeeID:
// - If Employees.EmployeeID is STRING/VARCHAR (e.g. codes, GUIDs) use DataTypes.STRING(50)
// - If Employees.EmployeeID is INTEGER (numeric PK) use DataTypes.INTEGER (uncomment the INT version)

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Workflow = sequelize.define('Workflow', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    // CHILD FK: employeeId
    // Default: STR(50). If Employees.EmployeeID is INT, replace with INTEGER as described below.
    employeeId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'employeeId'
    },

    /* --- If your Employees.EmployeeID is numeric (INT), replace the above `employeeId` field with this:
    employeeId: {
      type: DataTypes.INTEGER,       // match parent column type exactly (signed/unsigned)
      allowNull: false,
      field: 'employeeId'
    },
    --- Also ensure Employees.EmployeeID is INT (and unsigned if applicable). */

    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'type'
    },

    details: {
      // Use JSON type if your DB supports it; Sequelize will map accordingly for MySQL (JSON) / Postgres (JSON)
      type: DataTypes.JSON,
      allowNull: false,
      field: 'details'
    },

    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'status'
    },

    // createdAt / updatedAt will be managed by Sequelize when timestamps: true
  }, {
    tableName: 'Workflows',
    timestamps: true,
    underscored: false
  });

  // Associations (call this from your index/models loader after all models are defined)
  Workflow.associate = (models) => {
    // Workflow.employeeId references Employees.EmployeeID
    // targetKey MUST match the attribute name used in Employees model (case-sensitive).
    Workflow.belongsTo(models.Employee, {
      foreignKey: 'employeeId',   // column on Workflows table
      targetKey: 'EmployeeID',    // column on Employees table (must match exactly)
      as: 'employee',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  return Workflow;
};
