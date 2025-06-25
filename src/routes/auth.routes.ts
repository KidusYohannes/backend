import { Router } from 'express';
import { login, activateUserAccount } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.post('/activate', activateUserAccount);

export default router;
