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
import { sendEmail, sendEmailHtml } from '../services/email.service'; // Adjust import if needed
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });
const ACCESS_TOKEN_EXPIRES_IN = '30m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

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

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  res.json({ token, refreshToken });
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
  // Generate 6-character uppercase alphanumeric token
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const expiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await updateUser(user.id, { link_token: token, token_expiration: expiration.toISOString() });
  const emailContent = generateForgotPasswordEmail(user, token);
  console.log('Sending email:', emailContent);
  await sendEmailHtml(user.email, emailContent.subject, emailContent.html);
  res.json({ message: 'Password reset email sent' });
};

export const generateResetPasswordToken = async (req: Request, res: Response) => {
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
  // Generate a temporary token that expires in 30 minutes
  const tempToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30m' });
  res.json({ tempToken });
};

export const resetPasswordWithToken = async (req: Request, res: Response) => {
  const { newPassword } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization token is required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await findUserByEmail(String(payload.userId));
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Update password and clear any existing reset tokens
    await updateUser(user.id, { password: hashedPassword, link_token: '', token_expiration: '' });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ message: 'Refresh token required' });
    return;
  }
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: number };
    // Optionally, check if user still exists and is active
    const user = await findUserByEmail(String(payload.userId));
    if (!user || user.status !== 'accepted' || user === undefined) {
      res.status(401).json({ message: 'Invalid user' });
      return;
    }
    const newAccessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};
