import { Router } from 'express';
import { addMahiber, getMyMahibers, getMahiber, editMahiber, removeMahiber, getMahbers, getJoinedMahibers } from '../controllers/mahber.controller';
import { getMahberMembers } from '../controllers/member.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authenticateToken, addMahiber);
router.get('/', authenticateToken, getMyMahibers);
router.get('/joined', authenticateToken, getJoinedMahibers);
router.get('/all', getMahbers);
router.get('/:id', authenticateToken, getMahiber);
router.put('/:id', authenticateToken, editMahiber);
router.delete('/:id', authenticateToken, removeMahiber);
router.get('/:id/members', authenticateToken, getMahberMembers);

export default router;
