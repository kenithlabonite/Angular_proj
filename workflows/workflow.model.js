// src/models/workflow.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Workflow = sequelize.define('Workflow', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    // CHILD FK: employeeId
    employeeId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'employeeId'
    },


    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'type'
    },

    details: {
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

  }, {
    tableName: 'Workflows',
    timestamps: true,
    underscored: false
  });

  Workflow.associate = (models) => {
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
