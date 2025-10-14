import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface SmsLogAttributes {
  id: number;
  type: string;
  senderId: number;
  recipients: string;
  message: string;
  mahberId?: number | null;
  eventId?: number | null;
  status: string;
  timestamp: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SmsLogCreationAttributes extends Optional<SmsLogAttributes, 'id' | 'mahberId' | 'eventId' | 'status' | 'createdAt' | 'updatedAt'> {}

class SmsLog extends Model<SmsLogAttributes, SmsLogCreationAttributes> implements SmsLogAttributes {
  public id!: number;
  public type!: string;
  public senderId!: number;
  public recipients!: string;
  public message!: string;
  public mahberId!: number | null;
  public eventId!: number | null;
  public status!: string;
  public timestamp!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SmsLog.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    senderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    recipients: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    mahberId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    eventId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'sent'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: 'sms_log'
  }
);

export { SmsLog };