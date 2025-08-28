import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as contributionController from '../controllers/mahber_contribution.controller';

const router = Router();

// Create initial contributions for a new Mahber
router.post('/initial', authenticateToken, contributionController.createInitialContributionsController);

// Create a new contribution period for all members
router.post('/period', authenticateToken, contributionController.createNewContributionPeriodController);

// Get contributions for the authenticated user (supports status, pagination)
router.get('/my', authenticateToken, contributionController.getContributionsForUser);

// Get all unpaid contributions for the authenticated user (legacy, use /my?status=unpaid)
router.get('/my/unpaid', authenticateToken, contributionController.getUnpaidContributionsForUser);

// Get all unpaid contributions for the authenticated user (legacy, use /my?status=unpaid)
router.post('/create-contributions', contributionController.createDemoContributions);

// Get all contributions for a Mahber (paginated, descending order)
router.get(
  '/:mahber_id/history',
  authenticateToken,
  contributionController.getMahberContributionHistory
);

// Get current month contributions for a Mahber (paginated, descending order)
router.get(
  '/:mahber_id/current-month',
  authenticateToken,
  contributionController.getMahberCurrentMonthContributions
);

export default router;