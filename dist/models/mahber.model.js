"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mahber = void 0;
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
class Mahber extends sequelize_1.Model {
}
exports.Mahber = Mahber;
Mahber.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    created_by: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    desccription: { type: sequelize_1.DataTypes.STRING },
    type: { type: sequelize_1.DataTypes.STRING },
    contribution_unit: { type: sequelize_1.DataTypes.STRING },
    contribution_frequency: { type: sequelize_1.DataTypes.STRING },
    contribution_amount: { type: sequelize_1.DataTypes.STRING },
    contribution_start_date: { type: sequelize_1.DataTypes.DATEONLY },
    affiliation: { type: sequelize_1.DataTypes.STRING },
    created_at: { type: sequelize_1.DataTypes.DATE },
    updated_by: { type: sequelize_1.DataTypes.INTEGER },
    updated_at: { type: sequelize_1.DataTypes.DATE }
}, {
    sequelize: db_1.default,
    tableName: 'mahber',
    timestamps: false
});
