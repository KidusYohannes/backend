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
exports.activateUserAccount = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_service_1 = require("../services/user.service");
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    const user = yield (0, user_service_1.validateUserPassword)(email, password);
    if (!user) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});
exports.login = login;
const activateUserAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, token } = req.body;
    if (!email || !token) {
        res.status(400).json({ message: 'Email and token are required' });
        return;
    }
    const user = yield (0, user_service_1.findUserByEmail)(email);
    if (!user || user.link_token !== token) {
        res.status(400).json({ message: 'Invalid token or email' });
        return;
    }
    if (!user.token_expiration || new Date(user.token_expiration) < new Date()) {
        res.status(400).json({ message: 'Token expired' });
        return;
    }
    const activated = yield (0, user_service_1.activateUser)(email, token);
    if (activated) {
        res.json({ message: 'Account activated successfully' });
    }
    else {
        res.status(400).json({ message: 'Invalid or expired token' });
    }
});
exports.activateUserAccount = activateUserAccount;
