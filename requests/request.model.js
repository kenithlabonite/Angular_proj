const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Request = sequelize.define(
    'Request',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      accountId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: DataTypes.ENUM('equipment', 'leave', 'resources'),
        allowNull: false,
      },
      items: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'disapproved', 'rejected'),
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
        allowNull: true,
        field: 'updated',
      },
    },
    {
      tableName: 'requests',
      timestamps: true,
      createdAt: 'created',
      updatedAt: 'updated',
    }
  );

  Request.associate = (models) => {
    Request.belongsTo(models.Account, {
      foreignKey: 'accountId',
      as: 'account',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Request.hasOne(models.Workflow, {
      foreignKey: 'requestId',
      as: 'workflow',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  };

  return Request;
};
