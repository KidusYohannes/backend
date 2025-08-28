import { Response, Request } from 'express';
import { createMahberWithContributionTerm, getMahbersByUser, getMahberById, updateMahber, deleteMahber, getAllMahbers, getJoinedMahbers, checkMahberStripeAccount, getFeaturedMahbers } from '../services/mahber.service';
import { Member } from '../models/member.model';
import { Mahber } from '../models/mahber.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import dotenv from 'dotenv';
import { getUserById } from '../services/user.service';
import { Op } from 'sequelize';
import stripeClient from '../config/stripe.config';
dotenv.config();

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
      stripe_status: req.body.stripe_status || '',
      contribution_start_date: req.body.effective_from || '',
    };

    let mahber, contributionTerm;
    console.log(`Creating Mahber with payload: ${JSON.stringify(payload)}`);
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
  const account = await stripeClient.accounts.create({
      type: "express",
      country: "US",
      email: user?.email,
      capabilities: {
        transfers: { requested: true },
      },
  });
  mahber.stripe_account_id = account.id;

  const updated = await updateMahber(Number(req.params.id), mahber, req.user.id);
  // await mahber.save();

  const accountLink = await stripeClient.accountLinks.create({
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
 * Possible values for memberStatus:
 * - 'accepted'   (joined, can also have memberRole: 'admin', 'member', etc. if accepted)
 * - 'invited'    (invited)
 * - 'requested'  (requested)
 * - 'rejected'   (rejected)
 * - 'left'       (left)
 * - 'none'       (not a member)
 */

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
  const memberMap: Record<string, { status: string, role?: string }> = {};
  memberRecords.forEach(m => {
    memberMap[String(m.edir_id)] = { status: m.status, role: m.status === 'accepted' ? m.role : undefined };
  });

  // Attach memberStatus and memberRole to each mahber
  const dataWithStatus = result.data.map((m: any) => ({
    ...m,
    memberStatus: memberMap[String(m.id)]?.status || 'none', // accepted, invited, requested, rejected, left, none
    memberRole: memberMap[String(m.id)]?.role || null        // admin, member, etc. (only if accepted)
  }));

  res.json({
    ...result,
    data: dataWithStatus
  });
};


export const getFeaturedPromotedMahbersController = async (req: Request, res: Response) => {
  
  const featuredPromoted = req.params.featuredPromoted;
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;
  const featuredMahbers = await getFeaturedMahbers(search, page, perPage, featuredPromoted);
  res.json(featuredMahbers);
};


export const getFeaturedPromotedMahbersControllerAuthenticated = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  
  const featuredPromoted = req.params.featuredPromoted;
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;
  const result = await getFeaturedMahbers(search, page, perPage, featuredPromoted);

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
  const memberMap: Record<string, { status: string, role?: string }> = {};
  memberRecords.forEach(m => {
    memberMap[String(m.edir_id)] = { status: m.status, role: m.status === 'accepted' ? m.role : undefined };
  });

  // Attach memberStatus and memberRole to each mahber
  const dataWithStatus = result.data.map((m: any) => ({
    ...m,
    memberStatus: memberMap[String(m.id)]?.status || 'none', // accepted, invited, requested, rejected, left, none
    memberRole: memberMap[String(m.id)]?.role || null        // admin, member, etc. (only if accepted)
  }));

  res.json({
    ...result,
    data: dataWithStatus
  });
};