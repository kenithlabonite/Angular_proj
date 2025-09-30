// employees/employee.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const attributes = {
    EmployeeID: {
      type: DataTypes.INTEGER.UNSIGNED,   // 🔑 Changed from STRING(32)
      allowNull: false,
      autoIncrement: true,                // 🔑 Auto-increment PK
      primaryKey: true,
      field: 'EmployeeID'
    },

    accountId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'accountId',
      references: {
        model: 'accounts',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },

    position: {
      type: DataTypes.STRING,
      allowNull: true
    },

    departmentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'DepartmentID',
      references: {
        model: 'departments',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },

    hireDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'hireDate'
    },

    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active'
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'created'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'updated'
    }
  };

  const options = {
    tableName: 'employees',
    timestamps: true,
    createdAt: 'created',
    updatedAt: 'updated'
  };

  const Employee = sequelize.define('Employee', attributes, options);

  Employee.associate = (models) => {
    if (models.Account) {
      Employee.belongsTo(models.Account, {
        foreignKey: 'accountId',
        targetKey: 'id',
        as: 'Account'
      });
    }
    if (models.Department) {
      Employee.belongsTo(models.Department, {
        foreignKey: 'departmentId',
        targetKey: 'id',
        as: 'Department'
      });
    }
    if (models.Workflow) {
      Employee.hasMany(models.Workflow, {
        foreignKey: 'employeeId',
        sourceKey: 'EmployeeID',
        as: 'Workflows'
      });
    }
  };

  return Employee;
};
