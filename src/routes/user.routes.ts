import { Router } from 'express';
import {
  getUsers,
  getUser,
  addUser,
  editUser,
  removeUser,
  getActiveUser
} from '../controllers/user.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', authenticateToken, getActiveUser);

router.get('/', authenticateToken, getUsers); 
router.get('/:id', authenticateToken, getUser);
router.post('/', addUser); // Registration usually doesn't require auth
router.put('/:id', authenticateToken, editUser);
router.delete('/:id', authenticateToken, removeUser);

export default router;
