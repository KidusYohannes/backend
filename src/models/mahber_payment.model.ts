import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface MahberPaymentAttributes {
  id?: number;
  mahber_id: number;
  member_id: number;
  stripe_payment_id: string;
  amount_paid: number;
  receipt_url?: string;
  paid_at?: string; // ISO string or Date
}

interface MahberPaymentCreationAttributes extends Optional<MahberPaymentAttributes, 'id'> {}

export class MahberPayment extends Model<MahberPaymentAttributes, MahberPaymentCreationAttributes> implements MahberPaymentAttributes {
  public id!: number;
  public mahber_id!: number;
  public member_id!: number;
  public stripe_payment_id!: string;
  public amount_paid!: number;
  public receipt_url?: string;
  public paid_at?: string; // ISO string or Date
}
