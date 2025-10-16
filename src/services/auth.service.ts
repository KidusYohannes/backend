import { Member } from '../models/member.model';
import { User } from '../models/user.model';
import dotenv from 'dotenv';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Op } from 'sequelize';
import logger from '../utils/logger';
import { Mahber } from '../models/mahber.model';
dotenv.config();

async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await User.findOne({
    where: {
      id: userId,
      status: 'superadmin'
    }
  });
  logger.info(`isSuperAdmin: userId=${userId}, isSuperAdmin=${!!user}`);
  return !!user;
}

async function isAdminOfMahber(userId: string, mahberId: string): Promise<boolean> {
  // Check if the user is a superadmin first
  if (await isSuperAdmin(userId)) {
    return true;
  }

  const adminMember = await Member.findOne({
    where: {
      member_id: userId,
      edir_id: mahberId,
      role: 'admin',
      status: 'accepted'
    }
  });
  logger.info(`isAdminOfMahber: userId=${userId}, mahberId=${mahberId}, isAdmin=${!!adminMember} ${JSON.stringify(adminMember)}`);
  return !!adminMember;
}

export { isSuperAdmin, isAdminOfMahber };