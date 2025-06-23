import { Router } from 'express';
import { addMahiber, getMyMahibers, getMahiber, editMahiber, removeMahiber } from '../controllers/mahber.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authenticateToken, addMahiber);
router.get('/', authenticateToken, getMyMahibers);
router.get('/:id', authenticateToken, getMahiber);
router.put('/:id', authenticateToken, editMahiber);
router.delete('/:id', authenticateToken, removeMahiber);

export default router;
