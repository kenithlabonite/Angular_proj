// employees/employee.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Employee = sequelize.define(
    "Employee",
    {
      // 🆔 Primary Key
      EmployeeID: {
        type: DataTypes.STRING(20),
        allowNull: false,
        primaryKey: true,
      },

      // 👤 Link to Account
      accountId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "accounts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // 💼 Link to Position (string or foreign key)
      position: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // 🏢 Department reference (FK)
      departmentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        // ⚠️ Removed redundant FK creation by Sequelize to avoid duplicate error
        // The FK is already managed via manual associations in db.js
      },

      // 📅 Date hired
      hireDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      // ⚙️ Employment status
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },

      // 🕒 Sequelize timestamps
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "created",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "updated",
      },
    },
    {
      tableName: "employees",
      timestamps: true,
      createdAt: "created",
      updatedAt: "updated",
    }
  );

  // 🔗 Associations
  Employee.associate = (models) => {
    // Account → Employee (1:1)
    if (models.Account) {
      Employee.belongsTo(models.Account, {
        foreignKey: "accountId",
        targetKey: "id",
        as: "Account",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
    }

    // Department → Employee (1:N)
    if (models.Department) {
      Employee.belongsTo(models.Department, {
        foreignKey: "departmentId",
        targetKey: "id",
        as: "Department",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
    }

    // Employee → Workflow (1:N)
    if (models.Workflow) {
      Employee.hasMany(models.Workflow, {
        foreignKey: "employeeId",
        sourceKey: "EmployeeID",
        as: "Workflows",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
    }
  };

  return Employee;
};
