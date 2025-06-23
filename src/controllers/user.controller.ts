import { Request, Response } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  validateUserPassword,
  findUserByEmail
} from '../services/user.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  // Access authenticated user with req.user
  // const currentUser = req.user;
  // You can use currentUser to perform actions based on the authenticated user
  // For example, you might want to log the current user's ID or role
  // Example: const currentUser = req.user;
  const users = await getAllUsers();
  res.json(users);
};

export const getUser = async (req: Request, res: Response) => {
  const user = await getUserById(Number(req.params.id));
  if (!user) res.status(404).json({ message: 'User not found' });
  res.json(user);
};

export const addUser = async (req: Request, res: Response) => {
  // Check if email already exists
  const existingUser = await findUserByEmail(req.body.email);
  if (existingUser) {
     res.status(400).json({ message: 'Email already in use' });
  }
  try {
    // Do not set id, let the database handle auto-increment
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create user' });
  }
};

export const editUser = async (req: Request, res: Response) => {
  const user = await updateUser(Number(req.params.id), req.body);
  if (!user) res.status(404).json({ message: 'User not found' });
  res.json(user);
};

export const removeUser = async (req: Request, res: Response) => {
  const deleted = await deleteUser(Number(req.params.id));
  if (!deleted) res.status(404).json({ message: 'User not found' });
  res.status(204).send();
};

export const getActiveUser = (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'No active user' });
  }
  res.json(req.user);
};
