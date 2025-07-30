import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import {
  validateUserPassword,
  findUserByEmail,
  activateUser,
  updateUser
} from '../services/user.service';
import { generateForgotPasswordEmail } from './email.controller';
import { sendEmail } from '../services/email.service'; // Adjust import if needed
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await validateUserPassword(email, password);
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  // Treat inactive, deleted, or pending users as not found
  if(user.status === 'inactive' || user.status === 'deleted') {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  if(user.status === 'pending') {
    res.status(403).json({ message: 'Account is pending activation' });
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
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  if (user.link_token !== token) {
    res.status(400).json({ message: 'Invalid token or email: ' + user.link_token + ' : ' + token });
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

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }
  const user = await findUserByEmail(email);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  // Generate token and expiration
  const token = crypto.randomBytes(32).toString('hex');
  const expiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await updateUser(user.id, { link_token: token, token_expiration: expiration.toISOString() });
  const emailContent = generateForgotPasswordEmail(user, token);
  await sendEmail(user.email, emailContent.subject, emailContent.html);
  res.json({ message: 'Password reset email sent' });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    res.status(400).json({ message: 'Email, token, and new password are required' });
    return;
  }
  const user = await findUserByEmail(email);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  if (user.link_token !== token) {
    res.status(400).json({ message: 'Invalid token or email' });
    return;
  }
  if (!user.token_expiration || new Date(user.token_expiration) < new Date()) {
    res.status(400).json({ message: 'Token expired' });
    return;
  }
  // Update password and clear token
  await updateUser(user.id, { password: newPassword, link_token: '', token_expiration: '' });
  res.json({ message: 'Password reset successful' });
};
