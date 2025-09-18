// requests/request.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const attributes = {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    accountId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'accounts', // foreign key to accounts.id
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
      type: DataTypes.TEXT, // more flexible than STRING if you store JSON
      allowNull: false
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

  return sequelize.define('Request', attributes, options);
};
