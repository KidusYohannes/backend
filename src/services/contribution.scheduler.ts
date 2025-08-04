import cron from "node-cron";
import { Mahber } from "../models/mahber.model";
import { Member } from "../models/member.model";
import { MahberContributionTerm } from "../models/mahber_contribution_term.model";
import { MahberContribution } from "../models/mahber_contribution.model";
import { Op } from "sequelize";
import { createNewContributionPeriod } from './mahber_contribution.service'; // Import the service function

// Helper to calculate next period start date
function getNextPeriodDate(current: Date, frequency: number, unit: string): Date {
  const date = new Date(current);
  switch (unit) {
    case 'day': date.setDate(date.getDate() + frequency); break;
    case 'week': date.setDate(date.getDate() + frequency * 7); break;
    case 'month': date.setMonth(date.getMonth() + frequency); break;
    case 'year': date.setFullYear(date.getFullYear() + frequency); break;
  }
  return date;
}

/**
 * Scheduler to pre-generate contributions for the next period
 * This runs every day at 1 AM.
 * It checks all Mahbers and their members, and creates contributions for the next period
 * based on the active contribution term.
 */
cron.schedule('0 1 * * *', async () => {
  console.log('Running contribution pre-generation...');
  const mahbers = await Mahber.findAll();
  for (const mahber of mahbers) {
    if (mahber.stripe_status !== 'active') {
      console.log(`Skipping Mahber ${mahber.id} (${mahber.name}): Stripe account not active.`);
      continue;
    }
    const term = await MahberContributionTerm.findOne({
      where: { mahber_id: mahber.id, status: 'active' },
      order: [['effective_from', 'DESC']]
    });
    if (!term) continue;
    const members = await Member.findAll({ where: { edir_id: mahber.id, status: 'accepted' } });
    const memberIds = members.map(m => Number(m.member_id));
    // Find last period number and start date
    const lastContribution = await MahberContribution.findOne({
      where: { mahber_id: mahber.id },
      order: [['period_number', 'DESC']]
    });
    const nextPeriodNumber = lastContribution ? (lastContribution.period_number || 0) + 1 : 1;
    const lastStartDate = lastContribution ? new Date(lastContribution.period_start_date as string) : new Date(term.effective_from);
    const nextStartDate = getNextPeriodDate(lastStartDate, term.frequency, term.unit).toISOString().slice(0, 10);

    // Use the service function to create contributions for the next period
    await createNewContributionPeriod(
      mahber.id,
      memberIds,
      nextPeriodNumber,
      nextStartDate
    );
  }
  console.log('Contribution pre-generation completed.');
});