import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface MahberAttributes {
  id: number;
  name: string;
  created_by: number;
  description?: string;
  stripe_account_id: string;
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
  public description?: string;
  public stripe_account_id!: string; // new column for Stripe account ID
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

Mahber.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    created_by: { type: DataTypes.INTEGER, allowNull: false },
    description: { type: DataTypes.STRING },
    stripe_account_id: { type: DataTypes.STRING, allowNull: false }, // new column for Stripe account ID
    type: { type: DataTypes.STRING },
    contribution_unit: { type: DataTypes.STRING },
    contribution_frequency: { type: DataTypes.STRING },
    contribution_amount: { type: DataTypes.STRING },
    contribution_start_date: { type: DataTypes.DATEONLY },
    affiliation: { type: DataTypes.STRING },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_by: { type: DataTypes.INTEGER },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: 'mahber',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);
