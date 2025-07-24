import { Router } from 'express';
import { createOneTimePayment, createSubscriptionPayment, getOnboardingLink } from '../controllers/payment.controller';
import { createCheckoutPayment } from '../controllers/checkout.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Onboarding link (POST is recommended if using body for URLs)
router.post('/:id/onboarding-link', authenticateToken, getOnboardingLink);

// One-time payment
router.post('/:id/payment/one_time', authenticateToken, createOneTimePayment);

// Subscription payment
router.post('/:id/payment/subscription', authenticateToken, createSubscriptionPayment);

// Stripe Checkout Session (supports both one_time and subscription via :payment_type param)
router.post(
  '/:id/checkout/:payment_type',
  authenticateToken,
  (req, res, next) => {
	Promise.resolve(createCheckoutPayment(req, res)).catch(next);
  }
);

export default router;
