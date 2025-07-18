import { Request, Response } from 'express';
import { sendEmail } from '../services/email.service';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  validateUserPassword,
  findUserByEmail,
  activateUser
} from '../services/user.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  const users = await getAllUsers();
  res.json(users);
};

export const getUser = async (req: Request, res: Response) => {
  const user = await getUserById(Number(req.params.id));
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json(user);
};

export const addUser = async (req: Request, res: Response) => {
  const existingUser = await findUserByEmail(req.body.email);
  if (existingUser) {
    res.status(400).json({ message: 'Email already in use' });
    return;
  }
  try {
    const user = await createUser(req.body);

    // --- COMMENT OUT THIS BLOCK FOR LATER USE ---
    /*
    // Send verification email with link
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(user.link_token)}`;
    await sendEmail(
      user.email,
      'Verify your Mahber account',
      `Please verify your account by clicking the following link: ${verifyUrl}\n\nThis link will expire in 30 minutes.`
    );
    */

    // --- USE THIS FOR NOW: SEND ONLY THE 6-CHAR TOKEN ---
    // await sendEmail(
    //   user.email,
    //   'Your Mahber verification code',
    //   `Your verification code is: ${user.link_token}\n\nThis code will expire in 30 minutes.`
    // );

    //res.status(201).json({ message: 'User registered. Please check your email for the verification code.' });
    res.status(201).json({ message: 'User registered. Please login.' });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create user' });
  }
};

export const editUser = async (req: Request, res: Response) => {
  const user = await updateUser(Number(req.params.id), req.body);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json(user);
};

export const removeUser = async (req: Request, res: Response) => {
  const deleted = await deleteUser(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.status(204).send();
};

export const getActiveUser = (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'No active user' });
    return;
  }
  res.json(req.user);
};