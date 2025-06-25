import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

export type ContributionTermUnit = 'day' | 'week' | 'month' | 'year';

interface MahberContributionTermAttributes {
    id?: number;
    mahber_id: number;
    amount: number;
    frequency: number;
    unit: ContributionTermUnit;
    effective_from: string; // ISO string or Date
    created_at?: string; // ISO string or Date
    status?: string; // 'active' | 'inactive'
}

export interface MahberContributionTermCreationAttributes extends Optional<MahberContributionTermAttributes, 'id' | 'status'> {}

export class MahberContributionTerm extends Model<MahberContributionTermAttributes, MahberContributionTermCreationAttributes> implements MahberContributionTermAttributes {
  public id!: number;
  public mahber_id!: number;
  public amount!: number;
  public frequency!: number;
  public unit!: ContributionTermUnit;
  public effective_from!: string; // ISO string or Date
  public created_at?: string; // ISO string or Date
  public status?: string;
}

MahberContributionTerm.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    mahber_id: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.DECIMAL, allowNull: false },
    frequency: { type: DataTypes.INTEGER, allowNull: false },
    unit: { type: DataTypes.STRING, allowNull: false },
    effective_from: { type: DataTypes.DATEONLY, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' }
  },
  { sequelize, tableName: 'mahber_contribution_terms', timestamps: false }
);
