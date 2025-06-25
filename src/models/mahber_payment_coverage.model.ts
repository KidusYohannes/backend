import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface MahberPaymentCoverageAttributes {
  id?: number;
  payment_id: number;
  contribution_id: number;
  amount_applied: number;
}
export interface MahberPaymentCoverageCreationAttributes extends Optional<MahberPaymentCoverageAttributes, 'id'> {}

export class MahberPaymentCoverage extends Model<MahberPaymentCoverageAttributes, MahberPaymentCoverageCreationAttributes> implements MahberPaymentCoverageAttributes {
  public id!: number;
  public payment_id!: number;
  public contribution_id!: number;
  public amount_applied!: number;
}

MahberPaymentCoverage.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    payment_id: { type: DataTypes.INTEGER, allowNull: false },
    contribution_id: { type: DataTypes.INTEGER, allowNull: false },
    amount_applied: { type: DataTypes.DECIMAL, allowNull: false }
  },
  {
    sequelize,
    tableName: 'mahber_payment_coverage',
    timestamps: false
  }
);
