// requests/request.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Request = sequelize.define(
    'Request',
    {
      id: { // ✅ Use standard naming for Sequelize
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      accountId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'accounts', // ✅ FK to accounts table
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      type: {
        type: DataTypes.ENUM('equipment', 'leave', 'resources'),
        allowNull: false,
      },

      items: {
        type: DataTypes.STRING(255), // ✅ clear name and reasonable length
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

      createdAt: { // ✅ consistent with Sequelize timestamp standards
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
      timestamps: true, // ✅ enables createdAt and updatedAt automatically
      createdAt: 'created',
      updatedAt: 'updated',
    }
  );

  // 🔗 Associations
  Request.associate = (models) => {
    if (models.Account) {
      Request.belongsTo(models.Account, {
        foreignKey: 'accountId',
        targetKey: 'id',
        as: 'Account',
      });
    }

    // ✅ One-to-one with Workflow (if applicable)
    if (models.Workflow) {
      Request.hasOne(models.Workflow, {
        foreignKey: 'requestId',
        as: 'Workflow',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  };

  return Request;
};
