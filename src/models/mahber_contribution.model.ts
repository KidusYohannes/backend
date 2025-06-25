import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';



interface MahberContributionAttributes {
  id?: number;
  mahber_id?: number;
  member_id?: number;
  period_number?: number;
  contribution_term_id?: number;
  amount_due?: number;
  amount_paid?: number;
  status?: string;
  createdAt?: string; // ISO string or Date
  period_start_date?: string; // ISO string or Date
}
interface MahberContributionCreationAttributes extends Optional<MahberContributionAttributes, 'id'> {}


//export type MahberContributionStatus = 'unpaid' | 'partial' | 'paid';

export class MahberContribution extends Model<MahberContributionAttributes, MahberContributionCreationAttributes> implements MahberContributionAttributes {
  public id!: number;
  public mahber_id?: number;
  public member_id?: number;
  public period_number?: number;
  public contribution_term_id?: number;
  public amount_due?: number;
  public amount_paid?: number;
  public status?: string;
  public createdAt?: string;
  public period_start_date?: string; // ISO string or Date
}

MahberContribution.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    mahber_id: { type: DataTypes.INTEGER },
    member_id: { type: DataTypes.INTEGER },
    period_number: { type: DataTypes.INTEGER },
    contribution_term_id: { type: DataTypes.INTEGER },
    amount_due: { type: DataTypes.DECIMAL },
    amount_paid: { type: DataTypes.DECIMAL },
    status: { type: DataTypes.STRING },
    createdAt: { type: DataTypes.DATE },
    period_start_date: { type: DataTypes.DATEONLY }
  },
  {
    sequelize,
    tableName: 'mahber_contributions',
    timestamps: false
  }
);
