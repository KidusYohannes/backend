"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateUser = exports.validateUserPassword = exports.findUserByEmail = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = void 0;
const sequelize_1 = require("sequelize");
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const user_model_1 = require("../models/user.model"); // If you have a Sequelize User model
// In-memory users array for demonstration
let users = [];
function generateToken(length = 6) {
    // Generates a 6-character alphanumeric token
    return crypto_1.default.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase();
}
const getAllUsers = () => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield user_model_1.User.findAll();
    return users.map(u => u.toJSON());
});
exports.getAllUsers = getAllUsers;
const getUserById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findByPk(id);
    return user ? user.toJSON() : undefined;
});
exports.getUserById = getUserById;
const createUser = (user) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if email already exists
    const existingUser = yield (0, exports.findUserByEmail)(user.email);
    if (existingUser) {
        throw new Error('Email already in use');
    }
    const hashedPassword = yield bcrypt_1.default.hash(user.password, 10);
    const linkToken = generateToken(16);
    const tokenExpiration = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    const createdUser = yield user_model_1.User.create(Object.assign(Object.assign({}, user), { password: hashedPassword, link_token: linkToken, token_expiration: tokenExpiration.toISOString(), status: 'inactive' }));
    return createdUser.toJSON();
});
exports.createUser = createUser;
const updateUser = (id, updated) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findByPk(id);
    if (!user)
        return undefined;
    yield user.update(updated);
    return user.toJSON();
});
exports.updateUser = updateUser;
const deleteUser = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findByPk(id);
    if (!user)
        return false;
    yield user.update({ status: 'inactive' });
    return true;
});
exports.deleteUser = deleteUser;
const findUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findOne({ where: { email } });
    return user ? user.toJSON() : undefined;
});
exports.findUserByEmail = findUserByEmail;
const validateUserPassword = (email, password) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield (0, exports.findUserByEmail)(email);
    if (user && (yield bcrypt_1.default.compare(password, user.password))) {
        return user;
    }
    return null;
});
exports.validateUserPassword = validateUserPassword;
const activateUser = (email, token) => __awaiter(void 0, void 0, void 0, function* () {
    const [count] = yield user_model_1.User.update({ status: 'active', link_token: undefined, token_expiration: undefined }, {
        where: {
            email,
            link_token: token,
            token_expiration: { [sequelize_1.Op.gt]: new Date() },
            status: 'inactive'
        }
    });
    return count > 0;
});
exports.activateUser = activateUser;
