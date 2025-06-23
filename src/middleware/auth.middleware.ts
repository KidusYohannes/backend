import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById } from '../services/user.service';
import { User } from '../models/user.model';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) res.status(401).json({ message: 'No token provided' });

  try {
    const payload = jwt.verify(token as string, JWT_SECRET) as unknown as { userId: string };
    const user = await getUserById(Number(payload.userId));
    if (!user) res.status(401).json({ message: 'Invalid token user' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};
