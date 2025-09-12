// create a route for webhook controller exported functions
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as webhook from '../controllers/webhook.controller';

const router = Router();

router.post('/success', authenticateToken, webhook.handlePaymentSuccess);
router.post('/cancel', authenticateToken, webhook.handlePaymentCancel);

export default router;