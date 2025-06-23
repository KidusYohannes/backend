import { Member } from '../models/member.model';
import { Mahber } from '../models/mahber.model';
import { Op } from 'sequelize';

export const getAllMahbers = async () => {
  return Mahber.findAll();
};

export const requestToJoinMahber = async (userId: string, edirId: string) => {
  // Check if user is already in a mahber
  const existing = await Member.findOne({ where: { member_id: userId, status: 'accepted' } });
  if (existing) throw new Error('User already in a mahber');
  // Check if already requested
  const pending = await Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'requested' } });
  if (pending) throw new Error('Already requested');
  return Member.create({ member_id: userId, edir_id: edirId, role: 'member', status: 'requested' });
};

export const inviteMember = async (adminId: string, edirId: string, userId: string) => {
  // Only admin can invite
  const admin = await Member.findOne({ where: { member_id: adminId, edir_id: edirId, role: 'admin', status: 'accepted' } });
  if (!admin) throw new Error('Only admin can invite');
  // Check if user is already in a mahber
  const existing = await Member.findOne({ where: { member_id: userId, status: 'accepted' } });
  if (existing) throw new Error('User already in a mahber');
  return Member.create({ member_id: userId, edir_id: edirId, role: 'member', status: 'invited' });
};

export const respondToInvite = async (userId: string, edirId: string, accept: boolean) => {
  const member = await Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'invited' } });
  if (!member) throw new Error('No invite found');
  if (accept) {
    // Accept: set all other memberships to rejected/banned
    await Member.update({ status: 'rejected' }, { where: { member_id: userId, status: { [Op.ne]: 'invited' } } });
    member.status = 'accepted';
    await member.save();
    return member;
  } else {
    member.status = 'rejected';
    await member.save();
    return member;
  }
};

export const respondToJoinRequest = async (adminId: string, edirId: string, userId: string, accept: boolean) => {
  // Only admin can accept/reject
  const admin = await Member.findOne({ where: { member_id: adminId, edir_id: edirId, role: 'admin', status: 'accepted' } });
  if (!admin) throw new Error('Only admin can respond');
  const member = await Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'requested' } });
  if (!member) throw new Error('No join request found');
  if (accept) {
    // Accept: set all other memberships to rejected/banned
    await Member.update({ status: 'rejected' }, { where: { member_id: userId, status: { [Op.ne]: 'requested' } } });
    member.status = 'accepted';
    await member.save();
    return member;
  } else {
    member.status = 'rejected';
    await member.save();
    return member;
  }
};

export const banMember = async (adminId: string, edirId: string, userId: string) => {
  const admin = await Member.findOne({ where: { member_id: adminId, edir_id: edirId, role: 'admin', status: 'accepted' } });
  if (!admin) throw new Error('Only admin can ban');
  const member = await Member.findOne({ where: { member_id: userId, edir_id: edirId } });
  if (!member) throw new Error('Member not found');
  member.status = 'banned';
  await member.save();
  return member;
};

export const unbanMember = async (adminId: string, edirId: string, userId: string) => {
  const admin = await Member.findOne({ where: { member_id: adminId, edir_id: edirId, role: 'admin', status: 'accepted' } });
  if (!admin) throw new Error('Only admin can unban');
  const member = await Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'banned' } });
  if (!member) throw new Error('Member not found');
  member.status = 'accepted';
  await member.save();
  return member;
};
