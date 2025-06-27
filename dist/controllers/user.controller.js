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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveUser = exports.removeUser = exports.editUser = exports.addUser = exports.getUser = exports.getUsers = void 0;
const user_service_1 = require("../services/user.service");
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const getUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield (0, user_service_1.getAllUsers)();
    res.json(users);
});
exports.getUsers = getUsers;
const getUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield (0, user_service_1.getUserById)(Number(req.params.id));
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    res.json(user);
});
exports.getUser = getUser;
const addUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const existingUser = yield (0, user_service_1.findUserByEmail)(req.body.email);
    if (existingUser) {
        res.status(400).json({ message: 'Email already in use' });
        return;
    }
    try {
        const user = yield (0, user_service_1.createUser)(req.body);
        // --- COMMENT OUT THIS BLOCK FOR LATER USE ---
        /*
        // Send verification email with link
        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(user.link_token)}`;
        await sendEmail(
          user.email,
          'Verify your Mahber account',
          `Please verify your account by clicking the following link: ${verifyUrl}\n\nThis link will expire in 30 minutes.`
        );
        */
        // --- USE THIS FOR NOW: SEND ONLY THE 6-CHAR TOKEN ---
        // await sendEmail(
        //   user.email,
        //   'Your Mahber verification code',
        //   `Your verification code is: ${user.link_token}\n\nThis code will expire in 30 minutes.`
        // );
        //res.status(201).json({ message: 'User registered. Please check your email for the verification code.' });
        res.status(201).json({ message: 'User registered. Please login.' });
    }
    catch (err) {
        res.status(400).json({ message: err.message || 'Failed to create user' });
    }
});
exports.addUser = addUser;
const editUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield (0, user_service_1.updateUser)(Number(req.params.id), req.body);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    res.json(user);
});
exports.editUser = editUser;
const removeUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const deleted = yield (0, user_service_1.deleteUser)(Number(req.params.id));
    if (!deleted) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    res.status(204).send();
});
exports.removeUser = removeUser;
const getActiveUser = (req, res) => {
    if (!req.user) {
        res.status(401).json({ message: 'No active user' });
        return;
    }
    res.json(req.user);
};
exports.getActiveUser = getActiveUser;
