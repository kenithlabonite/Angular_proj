const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Department', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    departmentName: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING },
    employeeCounts: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, {
    tableName: 'departments',
    timestamps: false
  });
};
