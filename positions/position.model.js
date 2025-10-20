// positions/position.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Position = sequelize.define(
    "Position",
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
        type: DataTypes.ENUM("active", "deactive"),
        allowNull: false,
        defaultValue: "active",
      },
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
      tableName: "positions",
      timestamps: true,
      createdAt: "created",
      updatedAt: "updated",
    }
  );

  /**
   * ✅ Update the status of a position
   * @param {number} id - The ID of the position
   * @param {'active' | 'deactive'} newStatus - The new status value
   * @returns {Promise<Object|null>} - The updated position or null if not found
   */
  Position.editStatus = async function (id, newStatus) {
    if (!["active", "deactive"].includes(newStatus)) {
      throw new Error("Invalid status value. Must be 'active' or 'deactive'.");
    }

    const position = await Position.findByPk(id);
    if (!position) {
      throw new Error("Position not found.");
    }

    position.status = newStatus;
    await position.save();
    return position;
  };

  return Position;
};
