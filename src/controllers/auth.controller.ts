import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import {
  validateUserPassword,
  findUserByEmail,
  activateUser,
  updateUser,
  getUserById,
  generateTokenExport
} from '../services/user.service';
import { generateForgotPasswordEmail, generateEmailVerificationEmail } from './email.controller';
import { sendEmail, sendEmailHtml } from '../services/email.service'; // Adjust import if needed
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-07-30.basil' as any});
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
    const emailContent = generateEmailVerificationEmail(user);
    await sendEmailHtml(user.email, emailContent.subject, emailContent.html);
    res.status(403).json({ message: 'Account is pending activation, verification email sent. Please check your email for the verification code.' });
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
    res.status(400).json({ message: 'Invalid token or email'});
    return;
  }
  if (!user.token_expiration || new Date(user.token_expiration) < new Date()) {
    // generate another token and resend email
    const newToken = generateTokenExport(6); // 6-character token
    const newExpiration = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    await updateUser(user.id, { link_token: newToken, token_expiration: newExpiration.toISOString() });
    const emailContent = generateEmailVerificationEmail(user);
    await sendEmailHtml(user.email, emailContent.subject, emailContent.html);
    res.status(400).json({ message: 'Token expired, activation email resent. Please check your email.' });
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
  const { email, token } = req.body;
  if (!email) {
    res.status(400).json({ message: 'Email is required' });
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
    logger.info(`Resetting password for userId: ${payload}`);
    logger.info(`Resetting password for userId: ${payload.userId}`);
    const user = await getUserById(Number(payload.userId));
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
