"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/me', auth_middleware_1.authenticateToken, user_controller_1.getActiveUser);
router.get('/', auth_middleware_1.authenticateToken, user_controller_1.getUsers);
router.get('/:id', auth_middleware_1.authenticateToken, user_controller_1.getUser);
router.post('/', user_controller_1.addUser); // Registration usually doesn't require auth
router.put('/:id', auth_middleware_1.authenticateToken, user_controller_1.editUser);
router.delete('/:id', auth_middleware_1.authenticateToken, user_controller_1.removeUser);
exports.default = router;
