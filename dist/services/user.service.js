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
exports.validateUserPassword = exports.findUserByEmail = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = void 0;
const db_1 = __importDefault(require("../config/db"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// In-memory users array for demonstration
let users = [];
const getAllUsers = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield db_1.default.query('SELECT * FROM users');
    return result.rows;
});
exports.getAllUsers = getAllUsers;
const getUserById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield db_1.default.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
});
exports.getUserById = getUserById;
const createUser = (user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Check if email already exists
    const existingUser = yield (0, exports.findUserByEmail)(user.email);
    if (existingUser) {
        throw new Error('Email already in use');
    }
    const hashedPassword = yield bcrypt_1.default.hash(user.password, 10);
    const result = yield db_1.default.query(`INSERT INTO users 
      (full_name, email, phone, password, link_token, token_expiration, profile, status, is_agreed_to_terms, last_access)
     VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`, [
        user.full_name,
        user.email,
        user.phone,
        hashedPassword,
        user.link_token,
        user.token_expiration,
        user.profile,
        (_a = user.status) !== null && _a !== void 0 ? _a : 'new',
        user.is_agreed_to_terms,
        user.last_access
    ]);
    return result.rows[0];
});
exports.createUser = createUser;
const updateUser = (id, updated) => __awaiter(void 0, void 0, void 0, function* () {
    // For brevity, only updating a subset of fields. Expand as needed.
    const result = yield db_1.default.query(`UPDATE users SET
      full_name = COALESCE($1, full_name),
      email = COALESCE($2, email),
      phone = COALESCE($3, phone),
      password = COALESCE($4, password),
      link_token = COALESCE($5, link_token),
      token_expiration = COALESCE($6, token_expiration),
      profile = COALESCE($7, profile),
      status = COALESCE($8, status),
      is_agreed_to_terms = COALESCE($9, is_agreed_to_terms),
      last_access = COALESCE($10, last_access)
     WHERE id = $11
     RETURNING *`, [
        updated.full_name,
        updated.email,
        updated.phone,
        updated.password,
        updated.link_token,
        updated.token_expiration,
        updated.profile,
        updated.status,
        updated.is_agreed_to_terms,
        updated.last_access,
        id
    ]);
    return result.rows[0];
});
exports.updateUser = updateUser;
const deleteUser = (id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield db_1.default.query('UPDATE users SET status = $1 WHERE id = $2 RETURNING *', ['inactive', id]);
    return ((_a = result.rowCount) !== null && _a !== void 0 ? _a : 0) > 0;
});
exports.deleteUser = deleteUser;
const findUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield db_1.default.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
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
