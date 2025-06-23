import { User } from '../models/user.model';
import pool from '../config/db';
import bcrypt from 'bcrypt';

// In-memory users array for demonstration
let users: User[] = [];

export const getAllUsers = async (): Promise<User[]> => {
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
};

export const getUserById = async (id: number): Promise<User | undefined> => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
};

export const createUser = async (user: User): Promise<User> => {
  // Check if email already exists
  const existingUser = await findUserByEmail(user.email);
  if (existingUser) {
    throw new Error('Email already in use');
  }

  const hashedPassword = await bcrypt.hash(user.password, 10);
  const result = await pool.query(
    `INSERT INTO users 
      (full_name, email, phone, password, link_token, token_expiration, profile, status, is_agreed_to_terms, last_access)
     VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      user.full_name,
      user.email,
      user.phone,
      hashedPassword,
      user.link_token,
      user.token_expiration,
      user.profile,
      user.status ?? 'new',
      user.is_agreed_to_terms,
      user.last_access
    ]
  );
  return result.rows[0];
};

export const updateUser = async (id: number, updated: Partial<User>): Promise<User | undefined> => {
  // For brevity, only updating a subset of fields. Expand as needed.
  const result = await pool.query(
    `UPDATE users SET
      full_name = COALESCE($1, full_name),
      email = COALESCE($2, email),
      phone = COALESCE($3, phone),
      password = COALESCE($4, password),
      link_token = COALESCE($5, link_token),
      token_expiration = COALESCE($6, token_expiration),
      profile = COALESCE($7, profile),
      status = COALESCE($8, status),
      is_agreed_to_terms = COALESCE($9, is_agreed_to_terms),
      last_access = COALESCE($10, last_access)
     WHERE id = $11
     RETURNING *`,
    [
      updated.full_name,
      updated.email,
      updated.phone,
      updated.password,
      updated.link_token,
      updated.token_expiration,
      updated.profile,
      updated.status,
      updated.is_agreed_to_terms,
      updated.last_access,
      id
    ]
  );
  return result.rows[0];
};

export const deleteUser = async (id: number): Promise<boolean> => {
  const result = await pool.query(
    'UPDATE users SET status = $1 WHERE id = $2 RETURNING *',
    ['inactive', id]
  );
  return (result.rowCount ?? 0) > 0;
};

export const findUserByEmail = async (email: string): Promise<User | undefined> => {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
};

export const validateUserPassword = async (email: string, password: string): Promise<User | null> => {
  const user = await findUserByEmail(email);
  if (user && await bcrypt.compare(password, user.password)) {
    return user;
  }
  return null;
};
