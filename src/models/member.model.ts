import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface MemberAttributes {
  id: number;
  member_id: string;
  edir_id: string;
  role: string;
  invite_link?: string;
  status: string;
}

interface MemberCreationAttributes extends Optional<MemberAttributes, 'id'> {}

export class Member extends Model<MemberAttributes, MemberCreationAttributes> implements MemberAttributes {
  public id!: number;
  public member_id!: string;
  public edir_id!: string;
  public role!: string;
  public invite_link?: string;
  public status!: string;
}
