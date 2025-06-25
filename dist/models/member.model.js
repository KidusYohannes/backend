"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Member = void 0;
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
class Member extends sequelize_1.Model {
}
exports.Member = Member;
Member.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    member_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    edir_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    role: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    invite_link: { type: sequelize_1.DataTypes.STRING },
    status: { type: sequelize_1.DataTypes.STRING, allowNull: false }
}, {
    sequelize: db_1.default,
    tableName: 'members',
    timestamps: false
});
