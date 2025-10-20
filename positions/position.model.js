// positions/position.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Position = sequelize.define(
    'Position',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      position: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'deactive'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    {
      tableName: 'positions',
      timestamps: false, // ✅ disable timestamps unless you plan to track created/updated
    }
  );

  // Optional association placeholder (if you connect to employees later)
  Position.associate = (models) => {
    if (models.Employee) {
      Position.hasMany(models.Employee, {
        foreignKey: 'positionId',
        as: 'employees',
        onDelete: 'SET NULL',
      });
    }
  };

  return Position;
};
