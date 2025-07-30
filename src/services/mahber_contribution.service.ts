import { Mahber } from '../models/mahber.model';
import { User } from '../models/user.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { MahberContributionTerm } from '../models/mahber_contribution_term.model';
import sequelize from '../config/db';
import { Op } from 'sequelize';
import { generateRecurringPaymentNoticeEmail } from '../controllers/email.controller';
import { sendEmailHtml } from '../services/email.service'; // Adjust the import based on your project structure

/**
 * Create initial contributions for all members when a Mahber is created.
 * @param mahber_id The Mahber ID
 * @param memberIds Array of user IDs who are initial members
 * @param startPeriodNumber The first period number (usually 1)
 * @param periodStartDate The start date for the first period
 */
export async function createInitialContributions(
  mahber_id: number,
  memberIds: number[],
  startPeriodNumber: number,
  periodStartDate: string
) {
  // Get the active contribution term for this Mahber
  const term = await MahberContributionTerm.findOne({
    where: { mahber_id },
    order: [['effective_from', 'DESC']]
  });
  if (!term) throw new Error('No contribution term found for this Mahber');

  // Create a contribution row for each member
  const contributions = await Promise.all(
    memberIds.map(member_id =>
      MahberContribution.create({
        mahber_id,
        member_id,
        period_number: startPeriodNumber,
        contribution_term_id: term.id,
        amount_due: term.amount,
        amount_paid: 0,
        status: 'unpaid',
        period_start_date: periodStartDate
      })
    )
  );
  return contributions;
}

/**
 * Create new contribution periods for all active members of a Mahber.
 * @param mahber_id The Mahber ID
 * @param memberIds Array of user IDs who are members
 * @param periodNumber The new period number
 * @param periodStartDate The start date for the new period
 */
export async function createNewContributionPeriod(
  mahber_id: number,
  memberIds: number[],
  periodNumber: number,
  periodStartDate: string
) {
  // Get the applicable contribution term for this period
  const term = await MahberContributionTerm.findOne({
    where: {
      mahber_id,
      effective_from: { [Op.lte]: periodStartDate }
    },
    order: [['effective_from', 'DESC']]
  });
  if (!term) throw new Error('No contribution term found for this Mahber at this period');

  // Create a contribution row for each member
  const contributions = await Promise.all(
    memberIds.map(async member_id => {
      const contrib = await MahberContribution.create({
        mahber_id,
        member_id,
        period_number: periodNumber,
        contribution_term_id: term.id,
        amount_due: term.amount,
        amount_paid: 0,
        status: 'unpaid',
        period_start_date: periodStartDate
      });
      // Send recurring payment notice email
      const user = await User.findByPk(member_id);
      const mahber = await Mahber.findByPk(mahber_id);
      if (user && mahber) {
        const email = generateRecurringPaymentNoticeEmail(user, mahber, term.amount, periodStartDate);
        await sendEmailHtml(user.email, email.subject, email.html);
      }
      return contrib;
    })
  );
  return contributions;
}

/**
 * Service function to create the first contribution row for a member joining a Mahber.
 * @param mahber_id The Mahber ID
 * @param member_id The User ID of the member
 */
export async function createFirstContributionForMember(
  mahber_id: number,
  member_id: number
) {
  return await sequelize.transaction(async (t) => {
    // Validate Mahber exists
    const mahber = await Mahber.findByPk(mahber_id, { transaction: t });
    if (!mahber) throw new Error('Mahber not found');

    // Validate User exists
    const user = await User.findByPk(member_id, { transaction: t });
    if (!user) throw new Error('User not found');

    // Get the active contribution term for this Mahber
    const term = await MahberContributionTerm.findOne({
      where: { mahber_id, status: 'active' },
      order: [['effective_from', 'DESC']],
      transaction: t
    });
    if (!term) throw new Error('No active contribution term found for this Mahber');

    // Check if a contribution already exists for this member and mahber
    const existing = await MahberContribution.findOne({
      where: { mahber_id, member_id, period_number: 1 },
      transaction: t
    });
    if (existing) return existing;

    // Create the first contribution row
    const contribution = await MahberContribution.create({
      mahber_id,
      member_id,
      period_number: 1,
      contribution_term_id: term.id,
      amount_due: term.amount,
      amount_paid: 0,
      status: 'unpaid',
      period_start_date: term.effective_from
    }, { transaction: t });

    return contribution;
  });
}
