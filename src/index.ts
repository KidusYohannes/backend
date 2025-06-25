import app from './app';
import path from 'path';
import fs from 'fs';


// Use process.cwd() to ensure logs are always in the project root, regardless of how the app is started
const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'app.log');


// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true }); // ensure parent dirs are created if needed
}

const logStream = fs.createWriteStream(logFile, { flags: 'a' });


// Home page route
app.get('/', (req, res) => {
  res.send('Welcome to Mahber!');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
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
