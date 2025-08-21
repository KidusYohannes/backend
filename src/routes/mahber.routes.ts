import { Router } from 'express';
import { addMahiber, getMyMahibers, getMahiber, editMahiber, removeMahiber, getMahbers, getJoinedMahibers, getOnboardingLink, getMahbersWithUserStanding,
    getFeaturedPromotedMahbersController, getFeaturedPromotedMahbersControllerAuthenticated
 } from '../controllers/mahber.controller';
import { getMahberMembers } from '../controllers/member.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authenticateToken, addMahiber);
router.get('/', authenticateToken, getMyMahibers);
router.get('/joined', authenticateToken, getJoinedMahibers);
router.get('/all', getMahbers);
router.get('/all-authenticated', authenticateToken, getMahbersWithUserStanding); // For authenticated users only
router.get('/:id', authenticateToken, getMahiber);
router.put('/:id', authenticateToken, editMahiber);
router.delete('/:id', authenticateToken, removeMahiber);
router.get('/:id/members', authenticateToken, getMahberMembers);
// Add onboarding link route (should be before /:id to avoid conflict)
router.get('/:id/onboarding-link', authenticateToken, getOnboardingLink);
router.get('/all/:featuredPromoted', getFeaturedPromotedMahbersController);
router.get('/all-authenticated/:featuredPromoted', authenticateToken, getFeaturedPromotedMahbersControllerAuthenticated);


export default router;
