import express from 'express';
import userRoutes from './routes/user.routes';
import mahiberRoutes from './routes/mahber.routes';
import memberRoutes from './routes/member.routes';
import authRoutes from './routes/auth.routes';
import paymentRoutes from './routes/payment.routes';
import contributionRoute from './routes/contribution.route';
import stripeWebhookRoutes from './webhooks/stripe.webhook.routes';
import webhookRoutes from './routes/webhook.routes';
import eventsRoutes from './routes/events.routes'
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import "./services/schdule.service"; // Import the schedule service to start the cron job
import logger from './utils/logger';
import { stripeWebhookHandler } from './webhooks/stripe.webhook';
import bodyParser from 'body-parser';

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secret') {
  throw new Error('JWT_SECRET must be set in environment variables and not use the default.');
}

const app = express();

app.use(helmet());
app.use(cors({
  origin: '*', // Set to your frontend URL in production process.env.CORS_ORIGIN || 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100 // limit each IP to 1000 requests per windowMs
}));
app.use(
  '/stripe/webhook',
  bodyParser.raw({ type: 'application/json' }),
  stripeWebhookHandler
);
app.use(express.json());

// Log all requests
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/users', userRoutes);
app.use('/mahber', mahiberRoutes);
app.use('/members', memberRoutes);
app.use('/payments', paymentRoutes);
app.use('/', authRoutes);
app.use('/contributions', contributionRoute);
app.use('/webhook', webhookRoutes)
app.use('/events', eventsRoutes);

// Error handler to log errors and avoid leaking stack traces
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message);
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

export default app;
