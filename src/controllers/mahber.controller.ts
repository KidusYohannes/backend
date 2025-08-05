import { Response, Request } from 'express';
import { createMahberWithContributionTerm, getMahbersByUser, getMahberById, updateMahber, deleteMahber, getAllMahbers, getJoinedMahbers, checkMahberStripeAccount } from '../services/mahber.service';
import { Member } from '../models/member.model';
import { Mahber } from '../models/mahber.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { getUserById } from '../services/user.service';
import { Op } from 'sequelize';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });

export const addMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  try {
    // Allow contribution fields to be optional (default to empty string if missing)
    // Default visibility to 'public' unless specified
    // Ensure not-null columns have empty string if missing
    const payload = {
      ...req.body,
      created_by: req.user.id,
      country: req.body.country || '',
      state: req.body.state || '',
      city: req.body.city || '',
      address: req.body.address || '',
      zip_code: req.body.zip_code || '',
      contribution_unit: req.body.contribution_unit || '',
      contribution_frequency: req.body.contribution_frequency || '',
      contribution_amount: req.body.contribution_amount || '',
      affiliation: req.body.affiliation || '',
      visibility: req.body.visibility || 'public',
      stripe_account_id: req.body.stripe_account_id || '',
      stripe_product_id: req.body.stripe_product_id || '',
      stripe_price_id: req.body.stripe_price_id || '',
      stripe_status: req.body.stripe_status || ''
    };

    let mahber, contributionTerm;
    // Only create contribution term if contribution fields are provided (not empty)
    if (
      payload.contribution_unit &&
      payload.contribution_frequency &&
      payload.contribution_amount &&
      payload.contribution_start_date
    ) {
      ({ mahber, contributionTerm } = await createMahberWithContributionTerm(payload));
    } else {
      mahber = await Mahber.create(payload);
      contributionTerm = null;
    }

    // Add creator as first member with admin role
    await Member.create({
      member_id: String(req.user.id),
      edir_id: (mahber.id).toString(),
      role: 'admin',
      status: 'accepted'
    });

    res.status(201).json({
      mahber,
      contributionTerm: contributionTerm
        ? {
            ...contributionTerm.toJSON(),
            amount: Number(contributionTerm.amount)
          }
        : null
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create mahber' });
  }
};

export const getMyMahibers = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) { 
        res.status(401).json({ message: 'Unauthorized' }); 
    }else {
        const mahibers = await getMahbersByUser(req.user.id);
        res.json(mahibers);
    }
};

export const getJoinedMahibers = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahbers = await getJoinedMahbers(req.user.id);
  res.json(mahbers);
};

export const getMahbers = async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;

  // Only get mahbers with visibility 'public'
  const result = await getAllMahbers(search, page, perPage);
  res.json(result);
};

export const getMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahiber = await getMahberById(Number(req.params.id));
  if( !mahiber ) {
    res.status(404).json({ message: 'Mahiber not found' });
    return;
  }
  if (mahiber.created_by !== req.user.id) {
    res.status(404).json({ message: 'Unauthorized access: created_by'});
    return;
  }

  // Get member counts by status
  const [joined, invited, requested, rejected] = await Promise.all([
    Member.count({ where: { edir_id: String(mahiber.id), status: 'accepted' } }),
    Member.count({ where: { edir_id: String(mahiber.id), status: 'invited' } }),
    Member.count({ where: { edir_id: String(mahiber.id), status: 'requested' } }),
    Member.count({ where: { edir_id: String(mahiber.id), status: 'rejected' } }),
  ]);

  res.json({
    ...mahiber,
    memberCounts: {
      joined,
      invited,
      requested,
      rejected
    }
  });
};

export const editMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahiber = await getMahberById(Number(req.params.id));
  if (!mahiber || mahiber.created_by !== req.user.id) {
    res.status(404).json({ message: 'Mahiber not found or not authorized' });
    return;
  }
  try {
    const updated = await updateMahber(Number(req.params.id), {
      ...req.body,
      country: req.body.country,
      state: req.body.state,
      city: req.body.city,
      address: req.body.address,
      zip_code: req.body.zip_code
    }, req.user.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update mahiber' });
  }
};

export const removeMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahiber = await getMahberById(Number(req.params.id));
  if (!mahiber || mahiber.created_by !== req.user.id) {
    res.status(404).json({ message: 'Mahiber not found or not authorized' });
    return;
  }
  const deleted = await deleteMahber(Number(req.params.id), req.user.id);
  if (!deleted) {
    res.status(404).json({ message: 'Mahiber not found' });
    return;
  }
  res.status(204).send();
};

export const getOnboardingLink = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahberId = Number(req.params.id);
  const mahber = await getMahberById(mahberId);
  if (!mahber) {
    res.status(404).json({ message: 'Mahber not found' });
    return;
  }
  if (!mahber || mahber.created_by !== req.user.id) {
    res.status(404).json({ message: 'Mahiber not found or not authorized' });
    return;
  }
  const user = await getUserById(Number(mahber.created_by));
  const account = await stripe.accounts.create({
      type: "express",
      country: "US", // or ET if Ethiopia is supported
      email: user?.email,
      capabilities: {
        transfers: { requested: true },
      },
  });
  mahber.stripe_account_id = account.id;

  const updated = await updateMahber(Number(req.params.id), mahber, req.user.id);
  // await mahber.save();

  const accountLink = await stripe.accountLinks.create({
    account: mahber.stripe_account_id,
    refresh_url: "https://yenetech.com/stripe/refresh",
    return_url: "https://yenetech.com/stripe/return",
    type: "account_onboarding",
  });
  res.json({
    accountLinkUrl: accountLink.url
  }); 
}

/**
 * Get all mahbers with the authenticated user's standing (invited, accepted, rejected, left, or none).
 * Supports search, pagination.
 */
export const getMahbersWithUserStanding = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;

  // Get all mahbers (public only)
  const result = await getAllMahbers(search, page, perPage);

  // Get member records for this user
  const userId = String(req.user.id);
  // Ensure edir_id is string for comparison
  const mahberIds = result.data.map((m: any) => String(m.id));
  const memberRecords = await Member.findAll({
    where: {
      member_id: userId,
      edir_id: { [Op.in]: mahberIds }
    }
  });
  const memberMap: Record<string, string> = {};
  memberRecords.forEach(m => {
    memberMap[String(m.edir_id)] = m.status;
  });

  // Attach user standing to each mahber
  const dataWithStanding = result.data.map((m: any) => ({
    ...m,
    userStanding: memberMap[String(m.id)] || 'none'
  }));

  res.json({
    ...result,
    data: dataWithStanding
  });
};
