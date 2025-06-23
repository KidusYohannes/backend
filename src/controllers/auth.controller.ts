import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validateUserPassword } from '../services/user.service';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await validateUserPassword(email, password);
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
};
