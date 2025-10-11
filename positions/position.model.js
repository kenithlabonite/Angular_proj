// positions/position.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Position = sequelize.define('Position', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    position: {
      type: DataTypes.STRING(100),
      allowTopic: false,
      unique: true
    }
  });

  return Position;
};
