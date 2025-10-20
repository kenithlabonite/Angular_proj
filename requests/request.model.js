// requests/request.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Request = sequelize.define(
    "Request",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      accountId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "Accounts", key: "id" }, // ✅ Capitalized for consistency
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      type: {
        type: DataTypes.ENUM("equipment", "leave", "resources"),
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
        type: DataTypes.ENUM("pending", "approved", "disapproved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
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
      tableName: "requests",
      timestamps: true,
      createdAt: "created",
      updatedAt: "updated",
    }
  );

  // 🔗 Associations
  Request.associate = (models) => {
    // Each request belongs to one account
    Request.belongsTo(models.Account, {
      foreignKey: "accountId",
      as: "account",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // Each request may have one workflow tracking it
    Request.hasOne(models.Workflow, {
      foreignKey: "requestId",
      as: "workflow",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return Request;
};
