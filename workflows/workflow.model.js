const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Workflow = sequelize.define(
    'Workflow',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      employeeId: {
        type: DataTypes.STRING(20),
        allowNull: false,
        references: { model: 'employees', key: 'EmployeeID' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      requestId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'requests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      details: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated',
      },
    },
    {
      tableName: 'workflows',
      timestamps: true,
      createdAt: 'created',
      updatedAt: 'updated',
    }
  );

  Workflow.associate = (models) => {
    Workflow.belongsTo(models.Employee, {
      foreignKey: 'employeeId',
      targetKey: 'EmployeeID',
      as: 'employee',
    });

    Workflow.belongsTo(models.Request, {
      foreignKey: 'requestId',
      targetKey: 'id',
      as: 'request',
    });
  };

  return Workflow;
};
