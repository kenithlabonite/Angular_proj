// requests/request.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Request = sequelize.define(
    'Request',
    {
      // 🆔 Primary key
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // 👤 Foreign key to Accounts table
      accountId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'accounts', // FK target table
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 📦 Request type (e.g., equipment, leave, etc.)
      type: {
        type: DataTypes.ENUM('equipment', 'leave', 'resources'),
        allowNull: false,
      },

      // 📝 Item or resource name
      items: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      // 🔢 Quantity requested
      quantity: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },

      // 📊 Approval status
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'disapproved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },

      // 🕒 Creation and update timestamps
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
      timestamps: true, // enables createdAt and updatedAt
      createdAt: 'created',
      updatedAt: 'updated',
    }
  );

  // 🔗 Associations
  Request.associate = (models) => {
    // Many requests belong to one account
    if (models.Account) {
      Request.belongsTo(models.Account, {
        foreignKey: 'accountId',
        targetKey: 'id',
        as: 'account',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }

    // One request can have one related workflow entry
    if (models.Workflow) {
      Request.hasOne(models.Workflow, {
        foreignKey: 'requestId',
        as: 'workflow',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  };

  return Request;
};
