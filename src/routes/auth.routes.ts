import { Router } from 'express';
import { login, activateUserAccount, forgotPassword, generateResetPasswordToken, resetPasswordWithToken, refreshToken  } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.post('/activate', activateUserAccount);
router.post('/forgot-password', forgotPassword);
router.post('/reset/confirm-token', generateResetPasswordToken);
router.post('/reset-password', resetPasswordWithToken);
router.post('/refresh-token', refreshToken);


export default router;
