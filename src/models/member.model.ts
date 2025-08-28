import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';
import logger from '../utils/logger';

interface MemberAttributes {
  id: number;
  member_id: string;
  edir_id: string;
  role: string;
  invite_link?: string;
  stripe_subscription_id?: string; // optional Stripe subscription ID
  stripe_session_id?: string; // optional Stripe session ID
  status: string; // status is required and not nullable in the model
}

interface MemberCreationAttributes extends Optional<MemberAttributes, 'id'> {}

export class Member extends Model<MemberAttributes, MemberCreationAttributes> implements MemberAttributes {
  public id!: number;
  public member_id!: string;
  public edir_id!: string;
  public role!: string;
  public invite_link?: string;
  public stripe_subscription_id?: string;
  public stripe_session_id?: string;
  public status!: string;
}

Member.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    member_id: { type: DataTypes.STRING, allowNull: false },
    edir_id: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false },
    invite_link: { type: DataTypes.STRING },
    stripe_subscription_id: { type: DataTypes.STRING },
    stripe_session_id: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, allowNull: false }
  },
  {
    sequelize,
    tableName: 'members',
    timestamps: false
  }
);

export async function saveStripeSessionId(edirId: string, memberId: string, sessionId: string): Promise<boolean> {
  const member = await Member.findOne({ where: { edir_id: edirId, member_id: memberId } });
  if (!member) return false;
  try {
    await member.update({ stripe_session_id: sessionId });
    logger.info(`Updated Member model stripe_session_id for member ${memberId} in edir ${edirId}`);
  } catch (error) {
    logger.error('Error updating Member model stripe_session_id:', error);
    return false;
  }
  return true;
}


export async function saveStripeSubscriptionId(edirId: string, memberId: string, subscriptionId: string): Promise<boolean> {
  const member = await Member.findOne({ where: { edir_id: edirId, member_id: memberId } });
  if (!member) return false;
  await member.update({ stripe_subscription_id: subscriptionId });
  return true;
}
