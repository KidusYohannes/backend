import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/:id/onboarding-link', authenticateToken, paymentController.getOnboardingLink);
router.post('/:id/payment-intent', authenticateToken, paymentController.createPaymentIntent);

export default router;
