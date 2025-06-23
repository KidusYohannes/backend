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
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_service_1 = require("../services/user.service");
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const authenticateToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        res.status(401).json({ message: 'No token provided' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = yield (0, user_service_1.getUserById)(Number(payload.userId));
        if (!user)
            res.status(401).json({ message: 'Invalid token user' });
        req.user = user;
        next();
    }
    catch (_a) {
        res.status(401).json({ message: 'Invalid token' });
    }
});
exports.authenticateToken = authenticateToken;
