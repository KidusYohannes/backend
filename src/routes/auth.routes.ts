import { Router } from 'express';
import { login, activateUserAccount, forgotPassword, resetPassword, refreshToken  } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.post('/activate', activateUserAccount);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);


export default router;
