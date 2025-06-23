import { Mahber } from '../models/mahber.model';
import pool from '../config/db';

export const createMahber = async (mahber: Omit<Mahber, 'id' | 'created_at' | 'updated_at'>): Promise<Mahber> => {
  const result = await pool.query(
    `INSERT INTO mahber 
      (name, created_by, desccription, type, contribution_unit, contribution_frequency, contribution_amount, affiliation, contribution_start_date, created_at)
     VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING *`,
    [
      mahber.name,
      mahber.created_by,
      mahber.desccription,
      mahber.type,
      mahber.contribution_unit,
      mahber.contribution_frequency,
      mahber.contribution_amount,
      mahber.affiliation,
      mahber.contribution_start_date
    ]
  );
  return result.rows[0];
};

export const getMahbersByUser = async (userId: number): Promise<Mahber[]> => {
  const result = await pool.query('SELECT * FROM mahber WHERE created_by = $1', [userId]);
  return result.rows;
};

export const getMahberById = async (id: number): Promise<Mahber | undefined> => {
  const result = await pool.query('SELECT * FROM mahber WHERE id = $1', [id]);
  return result.rows[0];
};

export const updateMahber = async (id: number, updated: Partial<Mahber>, userId: number): Promise<Mahber | undefined> => {
  const result = await pool.query(
    `UPDATE mahber SET
      name = COALESCE($1, name),
      desccription = COALESCE($2, desccription),
      type = COALESCE($3, type),
      contribution_unit = COALESCE($4, contribution_unit),
      contribution_frequency = COALESCE($5, contribution_frequency),
      contribution_amount = COALESCE($6, contribution_amount),
      affiliation = COALESCE($7, affiliation),
      contribution_start_date = COALESCE($8, contribution_start_date),
      updated_by = $9,
      updated_at = NOW()
     WHERE id = $10 AND created_by = $9
     RETURNING *`,
    [
      updated.name,
      updated.desccription,
      updated.type,
      updated.contribution_unit,
      updated.contribution_frequency,
      updated.contribution_amount,
      updated.affiliation,
      updated.contribution_start_date,
      userId,
      id
    ]
  );
  return result.rows[0];
};

export const deleteMahber = async (id: number, userId: number): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM mahber WHERE id = $1 AND created_by = $2',
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
};
