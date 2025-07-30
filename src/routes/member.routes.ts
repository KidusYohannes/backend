import { Router } from 'express';
import * as memberController from '../controllers/member.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import * as mahber_contribution from '../controllers/mahber_contribution.controller';

const router = Router();

router.post('/request', authenticateToken, memberController.requestToJoin);
router.post('/invite', authenticateToken, memberController.inviteMember);
router.post('/invite/respond', authenticateToken, memberController.respondToInvite);
router.post('/request/respond', authenticateToken, memberController.respondToJoinRequest);
router.post('/ban', authenticateToken, memberController.banMember);
router.post('/unban', authenticateToken, memberController.unbanMember);

// Get all unpaid contributions for the authenticated user
router.get(
  '/contributions/unpaid',
  authenticateToken,
  async (req, res, next) => {
	try {
	  await mahber_contribution.getUnpaidContributionsForUser(req, res);
	} catch (err) {
	  next(err);
	}
  }
);

export default router;
