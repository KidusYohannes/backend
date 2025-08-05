import { Request, Response } from 'express';
import { createInitialContributions, createNewContributionPeriod } from '../services/mahber_contribution.service';
import { MahberContribution } from '../models/mahber_contribution.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { WhereOptions, Op } from 'sequelize';
import { Mahber } from '../models/mahber.model';
import { User } from '../models/user.model';

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
  const { status, page = 1, perPage = 10 } = req.query;
  const where: any = { member_id: req.user.id };
  if (status === 'unpaid' || status === 'paid') {
    where.status = status;
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

    const user = await User.findByPk(req.user.id);

    const data = rows.map(c => ({
      ...c.toJSON(),
      mahber_name: c.mahber_id !== undefined ? mahberMap.get(c.mahber_id) || null : null,
      user_name: user ? user.full_name : null,
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

    const data = rows.map(c => ({
      ...c.toJSON(),
      mahber_name: mahber ? mahber.name : null,
      user_name: typeof c.member_id === 'number' ? userMap.get(c.member_id)?.name || null : null,
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

    const data = rows.map(c => ({
      ...c.toJSON(),
      mahber_name: mahber ? mahber.name : null,
      user_name: typeof c.member_id === 'number' ? userMap.get(c.member_id)?.name || null : null,
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
