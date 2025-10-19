// employees/employee.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Employee = sequelize.define(
    'Employee',
    {
      EmployeeID: {
  type: DataTypes.STRING(20),
  allowNull: false,
  primaryKey: true,
  field: 'EmployeeID',
},


      accountId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'accounts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      position: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      departmentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'departments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      hireDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },

      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'created',
      },

      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'updated',
      },
    },
    {
      tableName: 'employees',
      timestamps: true,
      createdAt: 'created',
      updatedAt: 'updated',
    }
  );

  // 🔗 Associations
  Employee.associate = (models) => {
    if (models.Account) {
      Employee.belongsTo(models.Account, {
        foreignKey: 'accountId',
        targetKey: 'id',
        as: 'Account',
      });
    }

    if (models.Department) {
      Employee.belongsTo(models.Department, {
        foreignKey: 'departmentId',
        targetKey: 'id',
        as: 'Department',
      });
    }

    if (models.Workflow) {
      Employee.hasMany(models.Workflow, {
        foreignKey: 'employeeId',
        sourceKey: 'EmployeeID',
        as: 'Workflows',
      });
    }
  };

  return Employee;
};
