// workflows/workflow.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Workflow = sequelize.define('Workflow', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    employeeId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: { model: 'Employees', key: 'EmployeeID' }, // FK link
      onDelete: 'CASCADE'
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    details: {
      type: DataTypes.JSON, // store structured info (dept transfer, changes, etc.)
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
      allowNull: false,
      defaultValue: 'pending'
    }
  }, {
    tableName: 'Workflows',
    timestamps: true // adds createdAt & updatedAt
  });

  return Workflow;
};
