import { Response, Request } from 'express';
import { createMahberWithContributionTerm, getMahbersByUser, getMahberById, updateMahber, deleteMahber, getAllMahbers, getJoinedMahbers } from '../services/mahber.service';
import { Member } from '../models/member.model';
import { Mahber } from '../models/mahber.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { getUserById } from '../services/user.service';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });

export const addMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  try {
    // Always use the authenticated user as the creator
    const payload = {
      ...req.body,
      created_by: req.user.id
    };
    const { mahber, contributionTerm } = await createMahberWithContributionTerm(payload);

    // Add creator as first member with admin role
    await Member.create({
      member_id: String(req.user.id),
      edir_id: (mahber.id).toString(),
      role: 'admin',
      status: 'accepted'
    });

    res.status(201).json({ mahber, contributionTerm });
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
  console.log('Fetching joined mahbers for user:', req.user.id);
  const mahbers = await getJoinedMahbers(req.user.id);
  console.log('Joined mahbers:', mahbers);
  res.json(mahbers);
};

export const getMahbers = async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;

  const result = await getAllMahbers(search, page, perPage);
  res.json(result);
};

export const getMahiber = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahiber = await getMahberById(Number(req.params.id));
  if (!mahiber || mahiber.created_by !== req.user.id) {
    res.status(404).json({ message: 'Mahiber not found' });
    return;
  }
  res.json(mahiber);
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
    const updated = await updateMahber(Number(req.params.id), req.body, req.user.id);
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
  await mahber.save();

  const accountLink = await stripe.accountLinks.create({
    account: mahber.stripe_account_id,
    refresh_url: "https://yourapp.com/stripe/refresh",
    return_url: "https://yourapp.com/stripe/return",
    type: "account_onboarding",
  });
}
