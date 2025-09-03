import { Response } from 'express';
import * as memberService from '../services/member.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Member } from '../models/member.model';
import { User } from '../models/user.model';
import { Op } from 'sequelize';
import { Mahber } from '../models/mahber.model';

// Helper to resolve user_id from id or email
async function resolveUserId(user_id?: string, user_email?: string): Promise<string | null> {
  if (user_id) return user_id;
  if (user_email) {
    const user = await User.findOne({ where: { email: user_email } });
    return user ? user.id.toString() : null;
  }
  return null;
}

// Helper to check if the authenticated user is an admin of the Mahber
async function isAdminOfMahber(userId: string, mahberId: string): Promise<boolean> {
  const adminMember = await Member.findOne({
    where: {
      member_id: userId,
      edir_id: mahberId,
      role: 'admin',
      status: 'accepted'
    }
  });
  return !!adminMember;
}

export const getAllMahbers = async (_req: AuthenticatedRequest, res: Response) => {
  const mahbers = await memberService.getAllMahbers();
  res.json(mahbers);
};

export const requestToJoin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await memberService.requestToJoinMahber(req.user!.id.toString(), req.body.edir_id);
    res.status(201).json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const inviteMember = async (req: AuthenticatedRequest, res: Response) => {
  const mahberId = req.body.edir_id;
  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), mahberId))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can invite members.' });
    return;
  }

  try {
    const userId = await resolveUserId(req.body.user_id, req.body.user_email);
    if (!userId) {
      res.status(400).json({ message: 'User not found' });
      return;
    }
    const member = await memberService.inviteMember(req.user!.id.toString(), mahberId, userId);
    res.status(201).json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const respondToInvite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await memberService.respondToInvite(req.user!.id.toString(), req.body.edir_id, req.body.accept);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const respondToJoinRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = await resolveUserId(req.body.user_id, req.body.user_email);
    if (!userId) {
      res.status(400).json({ message: 'User not found' });
      return;
    }
    const member = await memberService.respondToJoinRequest(req.user!.id.toString(), req.body.edir_id, userId, req.body.accept);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const banMember = async (req: AuthenticatedRequest, res: Response) => {
  const mahberId = req.body.edir_id;
  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), mahberId))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can ban members.' });
    return;
  }

  try {
    const userId = await resolveUserId(req.body.user_id, req.body.user_email);
    if (!userId) {
      res.status(400).json({ message: 'User not found' });
      return;
    }
    const member = await memberService.banMember(req.user!.id.toString(), mahberId, userId);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const unbanMember = async (req: AuthenticatedRequest, res: Response) => {
  const mahberId = req.body.edir_id;
  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), mahberId))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can unban members.' });
    return;
  }

  try {
    const userId = await resolveUserId(req.body.user_id, req.body.user_email);
    if (!userId) {
      res.status(400).json({ message: 'User not found' });
      return;
    }
    const member = await memberService.unbanMember(req.user!.id.toString(), mahberId, userId);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const leaveMahber = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await Member.findOne({
      where: {
        member_id: req.user!.id.toString(),
        edir_id: req.body.edir_id,
        status: { [Op.not]: 'left' }
      }
    });
    if (!member) {
      res.status(404).json({ message: 'Membership not found or already left.' });
      return;
    }
    member.status = 'left';
    await member.save();
    res.json({ message: 'You have left the Mahber.' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const getMahberMembers = async (req: AuthenticatedRequest, res: Response) => {
  const mahberId = req.params.id;
  const { page = 1, perPage = 10 } = req.query;
  
  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), mahberId))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can view members.' });
    return;
  }
  try {
    // Get all members for the mahber, excluding those who left, paginated
    const { rows: members, count } = await Member.findAndCountAll({
      where: {
        edir_id: mahberId,
        status: { [Op.not]: 'left' }
      },
      offset: (Number(page) - 1) * Number(perPage),
      limit: Number(perPage),
      order: [['id', 'DESC']]
    });

    // Get user details for all member_ids
    const userIds = members.map(m => m.member_id);
    const users = await User.findAll({
      where: { id: userIds },
      attributes: ['id', 'full_name', 'email', 'phone', 'profile', 'status']
    });
    const userMap = new Map(users.map(u => [String(u.id), u]));

    // Merge user info into member objects
    const membersWithUser = members.map(m => ({
      ...m.toJSON(),
      user: userMap.get(m.member_id) || null
    }));

    res.json({
      data: membersWithUser,
      total: count,
      page: Number(page),
      perPage: Number(perPage)
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const getLeftMembers = async (req: AuthenticatedRequest, res: Response) => {
  const mahberId = req.body.edir_id;
  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), mahberId))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can view left members.' });
    return;
  }

  const { page = 1, perPage = 10 } = req.query;
  try {
    const { rows: members, count } = await Member.findAndCountAll({
      where: {
        edir_id: mahberId,
        status: 'left'
      },
      offset: (Number(page) - 1) * Number(perPage),
      limit: Number(perPage),
      order: [['id', 'DESC']]
    });

    const userIds = members.map(m => m.member_id);
    const users = await User.findAll({
      where: { id: userIds },
      attributes: ['id', 'full_name', 'email', 'phone', 'profile', 'status']
    });
    const userMap = new Map(users.map(u => [String(u.id), u]));

    const membersWithUser = members.map(m => ({
      ...m.toJSON(),
      user: userMap.get(m.member_id) || null
    }));

    res.json({
      data: membersWithUser,
      total: count,
      page: Number(page),
      perPage: Number(perPage)
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Change the role of a member (admin <-> member), but not for the creator.
 * Expects: { edir_id, user_id, new_role }
 * Only admins should be able to call this.
 */
export const changeMemberRole = async (req: AuthenticatedRequest, res: Response) => {
  const mahberId = req.body.edir_id;
  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), mahberId))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can change member roles.' });
    return;
  }

  const user_id = await resolveUserId(req.body.user_id, req.body.user_email);
  const { new_role } = req.body;
  if (!mahberId || !user_id || !new_role) {
    res.status(400).json({ message: 'edir_id, user_id, and new_role are required.' });
    return;
  }

  try {
    const mahber = await Mahber.findByPk(mahberId);
    if (!mahber) {
      res.status(404).json({ message: 'Mahber not found.' });
      return;
    }
    if (String(mahber.created_by) === String(user_id)) {
      res.status(403).json({ message: 'Cannot change role of the creator.' });
      return;
    }

    const member = await Member.findOne({
      where: {
        edir_id: String(mahberId),
        member_id: String(user_id)
      }
    });
    if (!member) {
      res.status(404).json({ message: 'Member not found.' });
      return;
    }
    member.role = new_role;
    await member.save();
    res.json({ message: `Role updated to ${new_role}.`, member });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};