"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const mahber_routes_1 = __importDefault(require("./routes/mahber.routes"));
const member_routes_1 = __importDefault(require("./routes/member.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
dotenv_1.default.config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secret') {
    throw new Error('JWT_SECRET must be set in environment variables and not use the default.');
}
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*', // Set to your frontend URL in production
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100 // limit each IP to 100 requests per windowMs
}));
app.use(express_1.default.json());
// Routes
app.use('/users', user_routes_1.default);
app.use('/mahber', mahber_routes_1.default);
app.use('/members', member_routes_1.default);
app.use('/', auth_routes_1.default);
// Error handler to avoid leaking stack traces
app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});
exports.default = app;
