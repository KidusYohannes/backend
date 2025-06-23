import { Router } from 'express';
import * as memberController from '../controllers/member.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/mahbers', authenticateToken, memberController.getAllMahbers);
router.post('/request', authenticateToken, memberController.requestToJoin);
router.post('/invite', authenticateToken, memberController.inviteMember);
router.post('/invite/respond', authenticateToken, memberController.respondToInvite);
router.post('/request/respond', authenticateToken, memberController.respondToJoinRequest);
router.post('/ban', authenticateToken, memberController.banMember);
router.post('/unban', authenticateToken, memberController.unbanMember);

export default router;
