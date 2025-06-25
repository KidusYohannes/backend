import express from 'express';
import userRoutes from './routes/user.routes';
import mahiberRoutes from './routes/mahber.routes';
import memberRoutes from './routes/member.routes';
import authRoutes from './routes/auth.routes';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secret') {
  throw new Error('JWT_SECRET must be set in environment variables and not use the default.');
}

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Set to your frontend URL in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100 // limit each IP to 100 requests per windowMs
}));
app.use(express.json());

// Routes
app.use('/users', userRoutes);
app.use('/mahber', mahiberRoutes);
app.use('/members', memberRoutes);
app.use('/', authRoutes);

// Error handler to avoid leaking stack traces
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

export default app;
