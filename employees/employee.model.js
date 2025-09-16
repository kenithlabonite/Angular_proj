const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const attributes = {
        // FK to accounts.id
        EmployeeID: { 
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: 'accounts', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        email: { type: DataTypes.STRING, allowNull: false },
        position: { type: DataTypes.STRING },
        department: { type: DataTypes.STRING },
        hireDate: { type: DataTypes.DATE },
        status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
    };

    const options = { timestamps: false };

    return sequelize.define('employee', attributes, options);
};
