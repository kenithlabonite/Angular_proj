const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const attributes = {
    accountId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      references: {
        model: 'accounts',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    employeeCode: {  // maps to EmployeeID in DB
      type: DataTypes.STRING(55),
      allowNull: true,
      unique: true,
      field: 'EmployeeID'
    },
    position: { type: DataTypes.STRING },
    department: { type: DataTypes.STRING },
    hireDate: { type: DataTypes.DATE },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active'
    },
    departmentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'DepartmentID'
    }
  };

  const options = {
    tableName: 'employees',
    timestamps: false
  };

  return sequelize.define('Employee', attributes, options);
};
