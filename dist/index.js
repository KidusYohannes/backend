"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Use process.cwd() to ensure logs are always in the project root, regardless of how the app is started
const logDir = path_1.default.join(process.cwd(), 'logs');
const logFile = path_1.default.join(logDir, 'app.log');
// Ensure log directory exists
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true }); // ensure parent dirs are created if needed
}
const logStream = fs_1.default.createWriteStream(logFile, { flags: 'a' });
// Home page route
app_1.default.get('/', (req, res) => {
    res.send('Welcome to Mahber!');
});
const PORT = process.env.PORT || 3000;
app_1.default.listen(PORT, () => {
    const message = `Server running on port ${PORT}\n`;
    console.log(message);
    logStream.write(message);
});
// Optional: handle process exit to close the log stream gracefully
process.on('SIGINT', () => {
    logStream.end('Server stopped\n', () => process.exit(0));
});
process.on('SIGTERM', () => {
    logStream.end('Server stopped\n', () => process.exit(0));
});
