import { Request, Response } from 'express';
import { createInitialContributions, createNewContributionPeriod } from '../services/mahber_contribution.service';
import { MahberContribution } from '../models/mahber_contribution.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { WhereOptions, Op } from 'sequelize';
import { Mahber } from '../models/mahber.model';
import { User } from '../models/user.model';
import { MahberContributionTerm } from '../models/mahber_contribution_term.model';
import logger from '../utils/logger';
import { Member } from '../models/member.model';

function getPeriodName(startDate: Date, unit: string): string {
  const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
  switch (unit) {
    case 'month':
      return startDate.toLocaleDateString('en-US', options);
    case 'week': {
      const weekNumber = getWeekNumber(startDate);
      return `${startDate.getFullYear()} Week ${weekNumber}`;
    }
    case 'year':
      return `${startDate.getFullYear()}`;
    case 'day':
      return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    case 'quarter': {
      const quarter = Math.floor(startDate.getMonth() / 3) + 1;
      return `Q${quarter} ${startDate.getFullYear()}`;
    }
    default:
      return startDate.toLocaleDateString('en-US', options);
  }
}
function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.ceil((days + start.getDay() + 1) / 7);
}

async function getContributionTermUnit(mahber_id: number) {
  const term = await MahberContributionTerm.findOne({
    where: { mahber_id, status: 'active' },
    order: [['effective_from', 'DESC']]
  });
  if (!term) return 'month'; // Default to month if no active term found
  return term.unit; // Return the unit of the active contribution term
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

/**
 * Create initial contributions for a new Mahber.
 * Expects: { mahber_id, memberIds, startPeriodNumber, periodStartDate }
 */
export const createInitialContributionsController = async (req: Request, res: Response) => {
  const { mahber_id, memberIds, startPeriodNumber, periodStartDate } = req.body;
  try {
    const contributions = await createInitialContributions(
      mahber_id,
      memberIds,
      startPeriodNumber,
      periodStartDate
    );
    res.status(201).json(contributions);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Create a new contribution period for all members.
 * Expects: { mahber_id, memberIds, periodNumber, periodStartDate }
 */

export const createNewContributionPeriodController = async (req: Request, res: Response) => {
  const { mahber_id, memberIds, periodNumber, periodStartDate } = req.body;
  try {
    const contributions = await createNewContributionPeriod(
      mahber_id,
      memberIds,
      periodNumber,
      periodStartDate
    );
    res.status(201).json(contributions);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * Get contributions for the authenticated user.
 * Query params:
 *   - status: 'unpaid' | 'paid' | undefined (if undefined, get all)
 *   - page: number (default 1)
 *   - perPage: number (default 10)
 */
export const getContributionsForUser = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return
  }
  const { status, mahber_id, page = 1, perPage = 10 } = req.query;
  const where: any = { member_id: req.user.id };
  if (status === 'unpaid' || status === 'paid') {
    where.status = status;
  }
  if (mahber_id) {
    where.mahber_id = Number(mahber_id);
  }
  try {
    const { rows, count } = await MahberContribution.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(perPage),
      limit: Number(perPage),
      order: [['period_start_date', 'DESC']]
    });

    // Fetch Mahber and User info for each contribution
    const mahberIds = Array.from(new Set(rows.map(c => c.mahber_id))).filter((id): id is number => typeof id === 'number');
    const mahbers = await Mahber.findAll({ where: { id: { [Op.in]: mahberIds } } });
    const mahberMap = new Map(mahbers.map(m => [m.id, m.name]));
    // mahber id to contribution term unit
    const contributionTermUnits = await Promise.all(
      mahberIds.map(id => getContributionTermUnit(id))
    );

    const user = await User.findByPk(req.user.id);

    const data = rows.map(c => ({
      ...c.toJSON(),
      mahber_name: c.mahber_id !== undefined ? mahberMap.get(c.mahber_id) || null : null,
      user_name: user ? user.full_name : null,
      period_name: getPeriodName(new Date(c.period_start_date as string), contributionTermUnits[mahberIds.indexOf(Number(c.mahber_id))]),
      user_email: user ? user.email : null
    }));

    res.json({
      data,
      total: count,
      page: Number(page),
      perPage: Number(perPage)
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get all unpaid contributions for the authenticated user.
 */
export const getUnpaidContributionsForUser = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  try {
    const unpaidContributions = await MahberContribution.findAll({
      where: {
        member_id: req.user.id,
        status: 'unpaid'
      },
      order: [['period_start_date', 'ASC']]
    });
    res.json(unpaidContributions);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get all contributions for a Mahber (paginated, descending order).
 * Query params: page, perPage
 * Only accessible by Mahber admin/creator (check in route/controller).
 */
export const getMahberContributionHistory = async (req: AuthenticatedRequest, res: Response) => {
  const mahber_id = Number(req.params.mahber_id);

  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), String(mahber_id)))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can view contribution history.' });
    return;
  }

  const { page = 1, perPage = 10 } = req.query;
  try {
    const { rows, count } = await MahberContribution.findAndCountAll({
      where: { mahber_id },
      offset: (Number(page) - 1) * Number(perPage),
      limit: Number(perPage),
      order: [['period_start_date', 'DESC']]
    });

    // Fetch Mahber and User info for each contribution
    const mahber = await Mahber.findByPk(mahber_id);
    const userIds = Array.from(new Set(rows.map(c => c.member_id))).filter((id): id is number => typeof id === 'number');
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } } });
    const userMap = new Map(users.map(u => [u.id, { name: u.full_name, email: u.email }]));

    const contributionTermUnits = await getContributionTermUnit(mahber_id);

    const data = rows.map(c => ({
      ...c.toJSON(),
      mahber_name: mahber ? mahber.name : null,
      user_name: typeof c.member_id === 'number' ? userMap.get(c.member_id)?.name || null : null,
      period_name: getPeriodName(new Date(c.period_start_date as string), contributionTermUnits),
      user_email: typeof c.member_id === 'number' ? userMap.get(c.member_id)?.email || null : null
    }));

    res.json({
      data,
      total: count,
      page: Number(page),
      perPage: Number(perPage)
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

export const getMahberCurrentMonthContributions = async (req: AuthenticatedRequest, res: Response) => {
  const mahber_id = Number(req.params.mahber_id);

  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), String(mahber_id)))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can view current month contributions.' });
    return;
  }

  const { page = 1, perPage = 10 } = req.query;
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  try {
    const { rows, count } = await MahberContribution.findAndCountAll({
      where: {
        mahber_id,
        period_start_date: { [Op.gte]: firstDay, [Op.lte]: lastDay }
      },
      offset: (Number(page) - 1) * Number(perPage),
      limit: Number(perPage),
      order: [['period_start_date', 'DESC']]
    });

    // Fetch Mahber and User info for each contribution
    const mahber = await Mahber.findByPk(mahber_id);
    const userIds = Array.from(new Set(rows.map(c => c.member_id))).filter((id): id is number => typeof id === 'number');
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } } });
    const userMap = new Map(users.map(u => [u.id, { name: u.full_name, email: u.email }]));
    const contributionTermUnits = await getContributionTermUnit(mahber_id);

    const data = rows.map(c => ({
      ...c.toJSON(),
      mahber_name: mahber ? mahber.name : null,
      user_name: typeof c.member_id === 'number' ? userMap.get(c.member_id)?.name || null : null,
      period_name: getPeriodName(new Date(c.period_start_date as string), contributionTermUnits),
      user_email: typeof c.member_id === 'number' ? userMap.get(c.member_id)?.email || null : null
    }));

    res.json({
      data,
      total: count,
      page: Number(page),
      perPage: Number(perPage)
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Create demo contributions for a Mahber.
 * Expects: { mahber_id, user_id, count }
 */
export const createDemoContributions = async (req: Request, res: Response) => {
  const { mahber_id, user_id, count } = req.body;

  if (!mahber_id || !user_id || !count || count <= 0) {
    res.status(400).json({ message: 'mahber_id, user_id, and count are required, and count must be greater than 0.' });
    return;
  }

  try {
    // Fetch the active contribution term for the Mahber
    const contributionTerm = await MahberContributionTerm.findOne({
      where: { mahber_id, status: 'active' },
      order: [['effective_from', 'DESC']]
    });

    if (!contributionTerm) {
      res.status(404).json({ message: 'No active contribution term found for the specified Mahber.' });
      return;
    }

    const { amount, unit, frequency, effective_from } = contributionTerm;

    // Get the last contribution for the user and Mahber
    const lastContribution = await MahberContribution.findOne({
      where: { mahber_id, member_id: user_id },
      order: [['period_number', 'DESC']]
    });
    let startPeriodNumber;
    let periodStartDate;

    let termId = contributionTerm.id;
    if (lastContribution) {
      startPeriodNumber = lastContribution.period_number ? lastContribution.period_number + 1 : 1;
      periodStartDate = lastContribution.period_start_date ? new Date(lastContribution.period_start_date) : new Date(effective_from);
    }else{
      startPeriodNumber = 1;
      periodStartDate = new Date(effective_from);
    }

    const contributions = [];

    // Create the specified number of contributions
    for (let i = 0; i < count; i++) {
      const contribution = MahberContribution.build({
        mahber_id,
        member_id: user_id,
        period_number: startPeriodNumber + i,
        period_start_date: String(new Date(periodStartDate)),
        amount_due: amount,
        contribution_term_id: termId,
        status: 'unpaid'
      });
      logger.info(`Creating demo contribution: ${JSON.stringify(contribution)}`);
      contributions.push(contribution);

      const createdContribution = await contribution.save();
      logger.info(`Created demo contribution: ${JSON.stringify(createdContribution)}`);

      // Calculate the next period start date based on the unit and frequency
      switch (unit) {
        case 'month':
          periodStartDate.setMonth(periodStartDate.getMonth() + frequency);
          break;
        case 'week':
          periodStartDate.setDate(periodStartDate.getDate() + frequency * 7);
          break;
        case 'year':
          periodStartDate.setFullYear(periodStartDate.getFullYear() + frequency);
          break;
        case 'day':
          periodStartDate.setDate(periodStartDate.getDate() + frequency);
          break;
        default:
          res.status(400).json({ message: `Unsupported contribution unit: ${unit}` });
          return;
      }

    }

    // Bulk create contributions
    //const createdContributions = await MahberContribution.bulkCreate(contributions);

    res.status(201).json({ message: 'Demo contributions created successfully.', contributions: contributions });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create demo contributions.' });
  }
};