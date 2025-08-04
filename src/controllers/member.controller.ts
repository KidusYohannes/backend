import { Response } from 'express';
import * as memberService from '../services/member.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Member } from '../models/member.model';
import { User } from '../models/user.model';
import { Op } from 'sequelize';

// Helper to resolve user_id from id or email
async function resolveUserId(user_id?: string, user_email?: string): Promise<string | null> {
  if (user_id) return user_id;
  if (user_email) {
    const user = await User.findOne({ where: { email: user_email } });
    return user ? user.id.toString() : null;
  }
  return null;
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
  try {
    const userId = await resolveUserId(req.body.user_id, req.body.user_email);
    if (!userId) {
      res.status(400).json({ message: 'User not found' });
      return;
    }
    const member = await memberService.inviteMember(req.user!.id.toString(), req.body.edir_id, userId);
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
  try {
    const userId = await resolveUserId(req.body.user_id, req.body.user_email);
    if (!userId) {
      res.status(400).json({ message: 'User not found' });
      return;
    }
    const member = await memberService.banMember(req.user!.id.toString(), req.body.edir_id, userId);
    res.json(member);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const unbanMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = await resolveUserId(req.body.user_id, req.body.user_email);
    if (!userId) {
      res.status(400).json({ message: 'User not found' });
      return;
    }
    const member = await memberService.unbanMember(req.user!.id.toString(), req.body.edir_id, userId);
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
  try {
    // Get all members for the mahber, excluding those who left
    const members = await Member.findAll({
      where: {
        edir_id: mahberId,
        status: { [Op.not]: 'left' }
      }
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

    res.json(membersWithUser);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const getLeftMembers = async (req: AuthenticatedRequest, res: Response) => {
  const mahberId = req.params.id;
  try {
    // Get all members who left the mahber
    const members = await Member.findAll({
      where: {
        edir_id: mahberId,
        status: 'left'
      }
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

    res.json(membersWithUser);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}