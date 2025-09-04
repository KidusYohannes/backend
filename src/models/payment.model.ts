import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface PaymentAttributes {
  id?: number;
  stripe_payment_id: string;
  receipt_url?: string;
  method: 'subscription' | 'one-time';
  contribution_id: string;
  member_id: number;
  mahber_id: string;
  amount: number;
  status: string;
  created_at?: string;
  session_id?: string;
}

interface PaymentCreationAttributes extends Optional<PaymentAttributes, 'id' | 'receipt_url' | 'created_at'> {}

export class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: number;
  public stripe_payment_id!: string;
  public receipt_url?: string;
  public method!: 'subscription' | 'one-time';
  public contribution_id!: string;
  public member_id!: number;
  public mahber_id!: string;
  public amount!: number;
  public status!: string;
  public created_at?: string;
  public session_id?: string;
}

Payment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    stripe_payment_id: { type: DataTypes.STRING, allowNull: false },
    receipt_url: { type: DataTypes.STRING },
    method: { type: DataTypes.STRING, allowNull: false },
    contribution_id: { type: DataTypes.STRING, allowNull: false },
    member_id: { type: DataTypes.INTEGER, allowNull: false },
    mahber_id: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    session_id: { type: DataTypes.STRING } // Optional field for storing session ID
  },
  { sequelize, tableName: 'mahber_payments', timestamps: false }
);
