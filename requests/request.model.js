// requests/request.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const attributes = {
    requestId: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    accountId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'accounts',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    type: {
      type: DataTypes.ENUM('equipment', 'leave', 'resources'),
      allowNull: false
    },
    items: {
      type: DataTypes.STRING(255), // item name
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'disapproved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    },
    created: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated: {
      type: DataTypes.DATE,
      allowNull: true
    }
  };

  const options = {
    tableName: 'requests',
    timestamps: false
  };

  const Request = sequelize.define('Request', attributes, options);

  Request.associate = (models) => {
    if (models.Account) {
      Request.belongsTo(models.Account, {
        foreignKey: 'accountId',
        targetKey: 'id',
        as: 'Account'
      });
    }
  };

  return Request;
};
