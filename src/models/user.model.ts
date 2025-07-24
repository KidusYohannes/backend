import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface UserAttributes {
  id?: number;
  full_name: string;
  email: string;
  phone: string;
  password: string;
  link_token?: string;
  token_expiration?: string;
  stripe_id?: string;
  profile?: string;
  status?: string;
  is_agreed_to_terms?: string;
  last_access?: string; // ISO string or Date
  payment_methods?: string; // JSON string for saved payment methods
}
interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public full_name!: string;
  public email!: string;
  public phone!: string;
  public password!: string;
  public link_token?: string;
  public token_expiration?: string;
  public stripe_id?: string;
  public profile?: string;
  public status?: string;
  public is_agreed_to_terms?: string;
  public last_access?: string; // ISO string or Date
  public payment_methods?: string; // JSON string for saved payment methods
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    full_name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    phone: { type: DataTypes.STRING, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    link_token: { type: DataTypes.STRING },
    token_expiration: { type: DataTypes.DATE },
    stripe_id: { type: DataTypes.STRING },
    profile: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING },
    is_agreed_to_terms: { type: DataTypes.STRING },
    last_access: { type: DataTypes.DATE },
    payment_methods: { type: DataTypes.TEXT } // or DataTypes.JSONB if using Postgres
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: false
  }
);