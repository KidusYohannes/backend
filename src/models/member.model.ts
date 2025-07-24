import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface MemberAttributes {
  id: number;
  member_id: string;
  edir_id: string;
  role: string;
  invite_link?: string;
  status: string; // status is required and not nullable in the model
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

Member.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    member_id: { type: DataTypes.STRING, allowNull: false },
    edir_id: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false },
    invite_link: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, allowNull: false }
  },
  {
    sequelize,
    tableName: 'members',
    timestamps: false
  }
);
  //   timestamps: false
  // }
// );
