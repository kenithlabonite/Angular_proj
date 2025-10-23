// requests/request.model.js
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
        type: DataTypes.TEXT, // store JSON string or plain text
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      status: {
        type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'draft',
      },
      created: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'requests',
      timestamps: false // using created/updated explicitly
    }
  );

  Request.associate = (models) => {
    Request.belongsTo(models.Account, {
      foreignKey: 'accountId',
      as: 'Account',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Request.hasOne(models.Workflow, {
      foreignKey: 'requestId',
      as: 'Workflow',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  };

  return Request;
};
