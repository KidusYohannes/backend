"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
class User extends sequelize_1.Model {
}
exports.User = User;
User.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    full_name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    email: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    phone: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    password: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    link_token: { type: sequelize_1.DataTypes.STRING },
    token_expiration: { type: sequelize_1.DataTypes.DATE },
    profile: { type: sequelize_1.DataTypes.STRING },
    status: { type: sequelize_1.DataTypes.STRING },
    is_agreed_to_terms: { type: sequelize_1.DataTypes.STRING },
    last_access: { type: sequelize_1.DataTypes.DATE }
}, {
    sequelize: db_1.default,
    tableName: 'users',
    timestamps: false
});
