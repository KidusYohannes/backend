import { Member } from '../models/member.model';
import { Mahber } from '../models/mahber.model';
import { MahberContributionTerm } from '../models/mahber_contribution_term.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { Op } from 'sequelize';
import { getCurrentPeriodNumber } from '../utils/utils';
import { User } from '../models/user.model';
import { generateMahberJoinConfirmationEmail } from '../controllers/email.controller';
import { sendEmail } from '../services/email.service'; // Adjust the import based on your project structure

export const getAllMahbers = async () => {
  return Mahber.findAll();
};


export const requestToJoinMahber = async (userId: string, edirId: string) => {
  // Check if user is already in a mahber
  const existing = await Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'accepted' } });
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
  try {
  // Check if user is already in a mahber
  const existing = await Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'accepted' } });
  if (existing) throw new Error('User already in a mahber');
    return Member.create({ member_id: userId, edir_id: edirId, role: 'member', status: 'invited', invite_link: '' });
  } catch (error) {
    console.log('Error inviting member:', error);
    throw error;
  }
};

async function createMemberContributionOnAccept(edirId: string, userId: string) {
  // Find Mahber and User
  const mahber = await Mahber.findByPk(edirId);
  if (!mahber) throw new Error('Mahber not found');

  // Get active contribution term
  const term = await MahberContributionTerm.findOne({
    where: { mahber_id: edirId, status: 'active' },
    order: [['effective_from', 'DESC']]
  });
  if (!term) throw new Error('No active contribution term found');

  // Get current period number
  const period_number = await getCurrentPeriodNumber(Number(edirId));

  // Check if contribution already exists for this member and period
  const exists = await MahberContribution.findOne({
    where: { mahber_id: Number(edirId), member_id: Number(userId), period_number }
  });
  if (exists) return exists;

  // Create the contribution row
  return MahberContribution.create({
    mahber_id: Number(edirId),
    member_id: Number(userId),
    period_number,
    contribution_term_id: term.id,
    amount_due: term.amount,
    amount_paid: 0,
    status: 'unpaid',
    period_start_date: term.effective_from
  });
}

export const respondToInvite = async (userId: string, edirId: string, accept: boolean) => {
  const member = await Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'invited' } });
  if (!member) throw new Error('No invite found');
  if (accept) {
    await Member.update({ status: 'rejected' }, { where: { member_id: userId, status: { [Op.ne]: 'invited' } } });
    member.status = 'accepted';
    await member.save();
    // Create member contribution for current period with status 'pending'
    await createMemberContributionOnAccept(edirId, userId);
    // Send Mahber join confirmation email
    const user = await User.findByPk(userId);
    const mahber = await Mahber.findByPk(edirId);
    if (user && mahber) {
      const email = generateMahberJoinConfirmationEmail(user, mahber);
      await sendEmail(user.email, email.subject, email.html);
    }
    return member;
  } else {
    member.status = 'rejected';
    await member.save();
    return member;
  }
};

export const respondToJoinRequest = async (adminId: string, edirId: string, userId: string, accept: boolean) => {
  if (!adminId || !edirId || !userId) {
    throw new Error('Invalid parameters');
  }
  //console.log(`Admin ID: ${adminId}, EDIR ID: ${edirId}, User ID: ${userId}, Accept: ${accept}`);
  // Only admin can accept/reject
  const admin = await Member.findOne({ where: { member_id: adminId, edir_id: edirId, role: 'admin', status: 'accepted' } });
  if (!admin) throw new Error('Only admin can respond');

  const member = await Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'requested' } });
  if (!member) throw new Error('No join request found');
  if (accept) {
    await Member.update({ status: 'rejected' }, { where: { member_id: userId, status: { [Op.ne]: 'requested' } } });
    member.status = 'accepted';
    await member.save();
    // Create member contribution for current period with status 'pending'
    await createMemberContributionOnAccept(edirId, userId);
    // Send Mahber join confirmation email
    const user = await User.findByPk(userId);
    const mahber = await Mahber.findByPk(edirId);
    if (user && mahber) {
      const email = generateMahberJoinConfirmationEmail(user, mahber);
      await sendEmail(user.email, email.subject, email.html);
    }
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
