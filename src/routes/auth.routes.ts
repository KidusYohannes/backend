import { Router } from 'express';
import { login, activateUserAccount, forgotPassword, resetPassword  } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.post('/activate', activateUserAccount);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);


export default router;
