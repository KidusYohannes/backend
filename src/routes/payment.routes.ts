import { Router } from 'express';
import {
  createOneTimePayment,
  createSubscriptionPayment,
  getOnboardingLink,
  unsubscribeFromMahberSubscription,
  getUserPaymentReports,
  getMahberPaymentReports,
  getMahberCurrentMonthPayments
} from '../controllers/payment.controller';
import { createCheckoutPayment } from '../controllers/checkout.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { createDonationPayment } from '../controllers/donationCheckout.controller';
import { handlePaymentCancel, handlePaymentSuccess } from '../controllers/webhook.controller';

const router = Router();

// Onboarding link (POST is recommended if using body for URLs)
router.post('/:id/onboarding-link', authenticateToken, getOnboardingLink);

// One-time payment
router.post('/:id/payment/one_time', authenticateToken, createOneTimePayment);

// Subscription payment
router.post('/:id/payment/subscription', authenticateToken, createSubscriptionPayment);

// unsubscribe from Stripe subscription
router.post('/:id/unsubscribe', authenticateToken, unsubscribeFromMahberSubscription);

// Stripe Checkout Session (supports both one_time and subscription via :payment_type param)
router.post(
  '/:id/checkout/:payment_type',
  authenticateToken,
  (req, res, next) => {
	  Promise.resolve(createCheckoutPayment(req, res)).catch(next);
  }
);

// donation checkout
router.post('/:id/donation', authenticateToken, createDonationPayment);

// User payment reports (paginated, descending order)
router.get( '/reports/my', authenticateToken, getUserPaymentReports );

// Mahber payment reports (paginated, descending order)
router.get( '/reports/mahber/:mahber_id', authenticateToken, getMahberPaymentReports );

// Mahber current month payment reports (paginated, descending order)
router.get( '/reports/mahber/:mahber_id/current-month', authenticateToken, getMahberCurrentMonthPayments );


// Webhook endpoints to handle payment returns from the website from the checkout session urls
router.post('/webhook/success', handlePaymentSuccess);
router.post('/webhook/cancel', handlePaymentCancel);

export default router;
