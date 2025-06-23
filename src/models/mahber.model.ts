import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface MahberAttributes {
  id: number;
  name: string;
  created_by: number;
  desccription?: string;
  type?: string;
  contribution_unit?: string; // was contribution_period
  contribution_frequency?: string; // new column
  contribution_amount?: string;
  contribution_start_date?: string;
  affiliation?: string;
  created_at?: Date;
  updated_by?: number;
  updated_at?: Date;
}

interface MahberCreationAttributes extends Optional<MahberAttributes, 'id'> {}

export class Mahber extends Model<MahberAttributes, MahberCreationAttributes> implements MahberAttributes {
  public id!: number;
  public name!: string;
  public created_by!: number;
  public desccription?: string;
  public type?: string;
  public contribution_unit?: string; // was contribution_period
  public contribution_frequency?: string; // new column
  public contribution_amount?: string;
  public contribution_start_date?: string;
  public affiliation?: string;
  public created_at?: Date;
  public updated_by?: number;
  public updated_at?: Date;
}
