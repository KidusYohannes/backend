import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import {
  validateUserPassword,
  findUserByEmail,
  activateUser,
  updateUser
} from '../services/user.service';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await validateUserPassword(email, password);
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  // Check and create Stripe customer if not present
  if (!user.stripe_id) {
    const stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: user.full_name,
      phone: user.phone
    });
    await updateUser(user.id, { stripe_id: stripeCustomer.id });
    user.stripe_id = stripeCustomer.id;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
};


export const activateUserAccount = async (req: Request, res: Response) => {
  const { email, token } = req.body;
  if (!email || !token) {
    res.status(400).json({ message: 'Email and token are required' });
    return;
  }
  const user = await findUserByEmail(email);
  if (!user || user.link_token !== token) {
    res.status(400).json({ message: 'Invalid token or email' });
    return;
  }
  if (!user.token_expiration || new Date(user.token_expiration) < new Date()) {
    res.status(400).json({ message: 'Token expired' });
    return;
  }
  const activated = await activateUser(email, token);
  if (activated) {
    res.json({ message: 'Account activated successfully' });
  } else {
    res.status(400).json({ message: 'Invalid or expired token' });
  }
};
