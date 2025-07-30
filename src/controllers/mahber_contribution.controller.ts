import { Request, Response } from 'express';
import { createInitialContributions, createNewContributionPeriod } from '../services/mahber_contribution.service';
import { MahberContribution } from '../models/mahber_contribution.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

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
 * Get all unpaid contributions for the authenticated user.
 */
export const getUnpaidContributionsForUser = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
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
