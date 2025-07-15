import { User } from '../models/user.model';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User as UserModel } from '../models/user.model'; // If you have a Sequelize User model
import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

// In-memory users array for demonstration
let users: User[] = [];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });

function generateToken(length = 6): string {
  // Generates a 6-character alphanumeric token
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase();
}

export const getAllUsers = async (): Promise<User[]> => {
  const users = await UserModel.findAll();
  return users.map(u => u.toJSON() as User);
};

export const getUserById = async (id: number): Promise<User | undefined> => {
  const user = await UserModel.findByPk(id);
  return user ? (user.toJSON() as User) : undefined;
};

export const createUser = async (user: User): Promise<User> => {
  // Check if email already exists
  const existingUser = await findUserByEmail(user.email);
  if (existingUser) {
    throw new Error('Email already in use');
  }

  const hashedPassword = await bcrypt.hash(user.password, 10);
  const linkToken = generateToken(16);
  const tokenExpiration = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

  // Create Stripe customer
  const stripeCustomer = await stripe.customers.create({
    email: user.email,
    name: user.full_name,
    phone: user.phone
  });

  const createdUser = await UserModel.create({
    ...user,
    password: hashedPassword,
    link_token: linkToken,
    token_expiration: tokenExpiration.toISOString(),
    status: 'active',
    stripe_id: stripeCustomer.id // Save Stripe customer ID
  });
  return createdUser.toJSON() as User;
};

export const updateUser = async (id: number, updated: Partial<User>): Promise<User | undefined> => {
  const user = await UserModel.findByPk(id);
  if (!user) return undefined;
  await user.update(updated);
  return user.toJSON() as User;
};

export const deleteUser = async (id: number): Promise<boolean> => {
  const user = await UserModel.findByPk(id);
  if (!user) return false;
  await user.update({ status: 'inactive' });
  return true;
};

export const findUserByEmail = async (email: string): Promise<User | undefined> => {
  const user = await UserModel.findOne({ where: { email } });
  return user ? (user.toJSON() as User) : undefined;
};

export const validateUserPassword = async (email: string, password: string): Promise<User | null> => {
  const user = await findUserByEmail(email);
  if (user && await bcrypt.compare(password, user.password)) {
    return user;
  }
  return null;
};

export const activateUser = async (email: string, token: string): Promise<boolean> => {
  const [count] = await UserModel.update(
    { status: 'active', link_token: undefined, token_expiration: undefined },
    {
      where: {
        email,
        link_token: token,
        token_expiration: { [Op.gt]: new Date() },
        status: 'inactive'
      }
    }
  );
  return count > 0;
};
