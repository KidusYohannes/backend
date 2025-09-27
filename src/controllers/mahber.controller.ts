import { Response, Request } from 'express';
import { createMahberWithContributionTerm, getMyMahibersService, getMahbersByUser, getMahberById, updateMahber, deleteMahber, getAllMahbers, getJoinedMahbers, checkMahberStripeAccount, getFeaturedMahbers, getAuthenticatedMahbers, getUnauthenticatedMahbers } from '../services/mahber.service';
import { Member } from '../models/member.model';
import { createFirstContributionForMember } from '../services/mahber_contribution.service';
import { Mahber } from '../models/mahber.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import dotenv from 'dotenv';
import { getUserById } from '../services/user.service';
import { Op } from 'sequelize';
import stripeClient from '../config/stripe.config';
import logger from '../utils/logger';
import { MahberContribution } from '../models/mahber_contribution.model';
dotenv.config();

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
  logger.info(`isAdminOfMahber: userId=${userId}, mahberId=${mahberId}, isAdmin=${!!adminMember} ${JSON.stringify(adminMember)}`);
  return !!adminMember;
}

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
      bylaws: req.body.bylaws || '',
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

    //check if contribution is not null and create the first MahberContribution for the admin or creator of the mahber
    if (contributionTerm) {
      // implement code here
      await createFirstContributionForMember(
        mahber.id,
        Number(req.user.id)
      );
    }

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

function castContributionAmount<T extends { contribution_amount?: any }>(mahber: T): T {
  return {
    ...mahber,
    contribution_amount: mahber.contribution_amount !== undefined && mahber.contribution_amount !== null
      ? Number(mahber.contribution_amount)
      : 0
  };
}

export const getMyMahibers = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const specificSearch = typeof req.query.specificSearch === 'string' ? JSON.parse(req.query.specificSearch) : {};
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;
  const userId = req.user.id;
  const where: any = { created_by: userId };

  // List of valid column names to prevent SQL injection
  const validColumns = [
    'name', 'description', 'type', 'affiliation', 'country', 'state', 'city', 'address', 'zip_code', 'visibility'
  ];

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { type: { [Op.iLike]: `%${search}%` } },
      { affiliation: { [Op.iLike]: `%${search}%` } },
      { country: { [Op.iLike]: `%${search}%` } },
      { state: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
      { zip_code: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Add specific search for multiple columns
  if (specificSearch && typeof specificSearch === 'object') {
    for (const [key, value] of Object.entries(specificSearch)) {
      const column = key;
      if (validColumns.includes(column) && typeof value === 'string') {
        where[column] = { [Op.iLike]: `%${value}%` };
      } else if (!validColumns.includes(column)) {
        throw new Error(`Invalid column name in specificSearch: ${column}`);
      }
    }
  }
  try {
    const result = await getAuthenticatedMahbers(where, page, perPage, String(userId));
    res.json({...result});
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

export const getJoinedMahibers = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const specificSearch = typeof req.query.specificSearch === 'string' ? JSON.parse(req.query.specificSearch) : {};
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;

  const user_id = String(req.user.id);
  // Fetch all mahbers where the user is a member with accepted, invited, or requested status
  const members = await Member.findAll({
    where: {
      member_id: user_id,
      status: { [Op.in]: ['accepted', 'invited', 'requested'] }
    }
  });

  const mahberIds = members.map(m => Number(m.edir_id));
  if (!mahberIds.length) {
     res.json({data: [], total: 0, page, perPage});
     return;
  }
  const where: any = { id: { [Op.in]: mahberIds } };

  // List of valid column names to prevent SQL injection
  const validColumns = [
    'name', 'description', 'type', 'affiliation', 'country', 'state', 'city', 'address', 'zip_code', 'visibility'
  ];

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { type: { [Op.iLike]: `%${search}%` } },
      { affiliation: { [Op.iLike]: `%${search}%` } },
      { country: { [Op.iLike]: `%${search}%` } },
      { state: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
      { zip_code: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Add specific search for multiple columns
  if (specificSearch && typeof specificSearch === 'object') {
    for (const [key, value] of Object.entries(specificSearch)) {
      const column = key;
      if (validColumns.includes(column) && typeof value === 'string') {
        where[column] = { [Op.iLike]: `%${value}%` };
      } else if (!validColumns.includes(column)) {
        throw new Error(`Invalid column name in specificSearch: ${column}`);
      }
    }
  }

  const result = await getAuthenticatedMahbers(where, page, perPage, user_id);
  // const castedMahbers = mahbers.map(castContributionAmount);
  res.json({...result});
};

export const getMahbers = async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const specificSearch = typeof req.query.specificSearch === 'string' ? JSON.parse(req.query.specificSearch) : {};
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;

  // List of valid column names to prevent SQL injection
  const validColumns = [
    'name', 'description', 'type', 'affiliation', 'country', 'state', 'city', 'address', 'zip_code', 'visibility'
  ];

  const where: any = {
    visibility: { [Op.ne]: 'private' }
  };

  if (search) {
    logger.info(`Searching mahbers with query: ${search}`);
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { type: { [Op.iLike]: `%${search}%` } },
      { affiliation: { [Op.iLike]: `%${search}%` } },
      { country: { [Op.iLike]: `%${search}%` } },
      { state: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
      { zip_code: { [Op.iLike]: `%${search}%` } }
    ];
  }

  logger.info(`Where clause before specific search before specificSearch: ${req.query.specificSearch} ${JSON.stringify(specificSearch)} and  ${JSON.stringify(where)}`);
  // Add specific search for multiple columns
  if (specificSearch && typeof specificSearch === 'object') {
    logger.info(`Applying specific search filters: ${JSON.stringify(specificSearch)}`);
    for (const [key, value] of Object.entries(specificSearch)) {
      const column = key;
      logger.info(`Processing specific search column: ${column} with value: ${value}`);
      if (validColumns.includes(column) && typeof value === 'string') {
        where[column] = { [Op.iLike]: `%${value}%` };
      }
       else if (!validColumns.includes(column)) {
        res.status(400).json({ message: `Invalid column name: ${column}` });
        return;
      }
    }
  }

  const result = await getUnauthenticatedMahbers(where, page, perPage);
  res.json({...result});
};

export const getMahiber = async (req: Request, res: Response) => {
  // if (!req.user) {
  //   res.status(401).json({ message: 'Unauthorized' });
  //   return;
  // }
  const mahiber = await getMahberById(Number(req.params.id));
  if( !mahiber ) {
    res.status(404).json({ message: 'Mahiber not found' });
    return;
  }
  // if (mahiber.created_by !== req.user.id) {
  //   res.status(404).json({ message: 'Unauthorized access: created_by'});
  //   return;
  // }

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
  if (!mahiber) {
    res.status(404).json({ message: 'Mahiber not found' });
    return;
  }

  // Check if the authenticated user is an admin of the Mahber
  // const isAdmin = await Member.findOne({
  //   where: {
  //     edir_id: String(mahiber.id),
  //     member_id: String(req.user.id),
  //     role: 'admin',
  //     status: 'accepted'
  //   }
  // });

  if (!(await isAdminOfMahber(req.user.id.toString(), String(mahiber.id)))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can update this Mahber.' });
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
  const specificSearch = typeof req.query.specificSearch === 'string' ? JSON.parse(req.query.specificSearch) : {};
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;

  // List of valid column names to prevent SQL injection
  const validColumns = [
    'name', 'description', 'type', 'affiliation', 'country', 'state', 'city', 'address', 'zip_code', 'visibility'
  ];

  const where: any = {
    visibility: { [Op.ne]: 'private' }
  };

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { type: { [Op.iLike]: `%${search}%` } },
      { affiliation: { [Op.iLike]: `%${search}%` } },
      { country: { [Op.iLike]: `%${search}%` } },
      { state: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
      { zip_code: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Add specific search for multiple columns
  if (specificSearch && typeof specificSearch === 'object') {
    for (const [key, value] of Object.entries(specificSearch)) {
      const column = key;
      logger.info(`Processing specific search column: ${column} with value: ${value}`);
      if (validColumns.includes(column) && typeof value === 'string') {
        where[column] = { [Op.iLike]: `%${value}%` };
      }
      // else if (!validColumns.includes(column)) {
      //   res.status(400).json({ message: `Invalid column name: ${column}` });
      //   return;
      // }
    }
  }

  const result = await getAuthenticatedMahbers(where, page, perPage, String(req.user.id));
  res.json({...result});
};


export const getFeaturedPromotedMahbersController = async (req: Request, res: Response) => {
  
  const featuredPromoted = req.params.featuredPromoted;
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;

  let where: any;
  if(featuredPromoted === 'featured'){
    where = {
      visibility: { [Op.ne]: 'private' },
      featured: "true"
    };
  }else if(featuredPromoted === 'promoted'){
    where = {
      visibility: { [Op.ne]: 'private' },
      promoted: "true"
    };
  }else{
    where = {
      visibility: { [Op.ne]: 'private' },
      featured: "true",
      promoted: "true"
    };
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { type: { [Op.iLike]: `%${search}%` } },
      { affiliation: { [Op.iLike]: `%${search}%` } },
      { country: { [Op.iLike]: `%${search}%` } },
      { state: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
      { zip_code: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const result = await getUnauthenticatedMahbers(where, page, perPage);

  // const featuredMahbers = await getFeaturedMahbers(search, page, perPage, featuredPromoted);
  // const castedData = featuredMahbers.data.map(castContributionAmount);
  res.json({...result});
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
  // const result = await getFeaturedMahbers(search, page, perPage, featuredPromoted);
  let where: any;
  if(featuredPromoted === 'featured'){
    where = {
      visibility: { [Op.ne]: 'private' },
      featured: "true"
    };
  }else if(featuredPromoted === 'promoted'){
    where = {
      visibility: { [Op.ne]: 'private' },
      promoted: "true"
    };
  }else{
    where = {
      visibility: { [Op.ne]: 'private' },
      featured: "true",
      promoted: "true"
    };
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { type: { [Op.iLike]: `%${search}%` } },
      { affiliation: { [Op.iLike]: `%${search}%` } },
      { country: { [Op.iLike]: `%${search}%` } },
      { state: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
      { zip_code: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const result = await getAuthenticatedMahbers(where, page, perPage, String(req.user.id));
  res.json({
    ...result
  });
};

function serializeWhereClause(where: any): any {
  // Recursively serialize Sequelize where clause for logging/debugging
  if (typeof where !== 'object' || where === null) return where;
  if (Array.isArray(where)) return where.map(serializeWhereClause);

  const result: any = {};
  for (const key of Object.keys(where)) {
    const value = where[key];
    if (typeof value === 'object' && value !== null) {
      result[key] = serializeWhereClause(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
