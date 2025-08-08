import { Router } from 'express';
import { stripeWebhookHandler } from './stripe.webhook';

// Stripe requires the raw body for webhook signature verification
import bodyParser from 'body-parser';

const router = Router();

router.post(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

export default router;
