import { Response, Request } from 'express';
import dotenv from 'dotenv';
import { getUserById, updateUser } from '../services/user.service';
import { getMahberById, updateMahber } from '../services/mahber.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Payment } from '../models/payment.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { Member } from '../models/member.model';
import { Mahber } from '../models/mahber.model';
import { User } from '../models/user.model';
import { Op } from 'sequelize';
import stripeClient from '../config/stripe.config';
import Stripe from 'stripe';
import logger from '../utils/logger';

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


export const getOnboardingLink = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const mahberId = Number(req.params.id);
  if (!(await isAdminOfMahber(req.user.id.toString(), String(mahberId)))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can access the onboarding link.' });
    return;
  }

  const mahber = await getMahberById(mahberId);
  if (!mahber) {
    res.status(404).json({ message: 'Mahber not found' });
    return;
  }

  try {
    let accountId = mahber.stripe_account_id;
    if (!accountId) {
      const stripeAccountPayload: Stripe.AccountCreateParams = {
        type: "express",
        country: "US",
        email: (await getUserById(Number(mahber.created_by)))?.email,
        capabilities: { transfers: { requested: true } },
      };
      const account = await stripeClient.accounts.create(stripeAccountPayload);
      accountId = account.id;
      mahber.stripe_account_id = accountId;
      await updateMahber(mahberId, mahber, req.user.id);
    }

    const refreshUrl = req.body.refresh_url || "https://yenetech.com/stripe/refresh";
    const returnUrl = req.body.return_url || "https://yenetech.com/stripe/return";
    const accountLink = await stripeClient.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    res.json({ accountLinkUrl: accountLink.url });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create onboarding link: ' + error });
  }
}

// Helper to get or update user's payment methods (now on user, not member)
async function getOrUpdateUserPaymentMethods(user: any, newMethod?: any, paymentType?: string) {
  let paymentMethods: any = {};
  if (user.payment_methods) {
    try {
      paymentMethods = JSON.parse(user.payment_methods);
    } catch {
      paymentMethods = {};
    }
  }

  if (newMethod && paymentType) {
    paymentMethods[paymentType] = newMethod;
    await updateUser(user.id, { payment_methods: JSON.stringify(paymentMethods) });
  }

  return paymentMethods;
}

// One-time payment
export const createOneTimePayment = async (req: AuthenticatedRequest, res: Response) => {
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
  if (!mahber.stripe_account_id || mahber.stripe_status !== 'active') {
    res.status(400).json({ message: 'Mahber Stripe account is not active. Please finish onboarding before making payments.' });
    return;
  }

  const user = await getUserById(Number(req.user.id));
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  if (!req.body.amount || typeof req.body.amount !== 'number' || req.body.amount <= 0) {
    res.status(400).json({ message: 'Invalid amount' });
    return;
  }

  // Ensure Stripe customer exists
  if (!user.stripe_id) {
    const stripeCustomer = await stripeClient.customers.create({
      email: user.email,
      name: user.full_name,
      phone: user.phone
    });
    await updateUser(user.id, { stripe_id: stripeCustomer.id });
    user.stripe_id = stripeCustomer.id;
  }

  // Retrieve or update payment method
  let paymentMethodId = req.body.payment_method_id;
  let savePaymentMethod = req.body.save_payment_method;
  let paymentMethods = await getOrUpdateUserPaymentMethods(user);

  // If user wants to use a saved payment method
  if (!paymentMethodId && req.body.use_saved && paymentMethods && paymentMethods['one_time']) {
    paymentMethodId = paymentMethods['one_time'].id;
  }

  // If user provides a new payment method and wants to save it
  if (paymentMethodId && savePaymentMethod) {
    await getOrUpdateUserPaymentMethods(user, { id: paymentMethodId }, 'one_time');
  }

  try {
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: req.body.amount,
      currency: 'usd',
      payment_method_types: ['card'],
      customer: user.stripe_id,
      payment_method: paymentMethodId,
      description: req.body.description || 'Mahber Contribution',
      transfer_data: {
        destination: mahber.stripe_account_id,
      },
      // If using a saved payment method, set off_session and confirm
      ...(paymentMethodId ? { off_session: false, confirm: false } : {})
    });

    // Find the latest unpaid contribution for this user and Mahber
    const contribution = await MahberContribution.findOne({
      where: {
        mahber_id: mahberId,
        member_id: req.user.id,
        status: 'unpaid'
      },
      order: [['period_number', 'DESC']]
    });

    // Record payment in payments table (mahber_payments)
    if (contribution) {
      await Payment.create({
        stripe_payment_id: paymentIntent.id,
        receipt_url: '', // You can update this after payment confirmation
        method: 'one-time',
        contribution_id: String(contribution.id),
        member_id: req.user.id,
        mahber_id: String(mahber.id),
        amount: req.body.amount,
        status: 'pending'
      });
    }

    res.json({ clientSecret: paymentIntent.client_secret, paymentMethods });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ message: 'Failed to create payment intent: ' + error });
  }
};

// Subscription payment
export const createSubscriptionPayment = async (req: AuthenticatedRequest, res: Response) => {
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
  if (!mahber.stripe_account_id || mahber.stripe_status !== 'active') {
    res.status(400).json({ message: 'Mahber Stripe account is not active. Please finish onboarding before making payments.' });
    return;
  }

  const user = await getUserById(Number(req.user.id));
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  const { price_id, payment_method_id, save_payment_method, use_saved } = req.body;
  if (!price_id) {
    res.status(400).json({ message: 'Missing price_id for subscription' });
    return;
  }

  // Ensure Stripe customer exists
  if (!user.stripe_id) {
    const stripeCustomer = await stripeClient.customers.create({
      email: user.email,
      name: user.full_name,
      phone: user.phone
    });
    await updateUser(user.id, { stripe_id: stripeCustomer.id });
    user.stripe_id = stripeCustomer.id;
  }

  // Retrieve or update payment method
  let finalPaymentMethodId = payment_method_id;
  let paymentMethods = await getOrUpdateUserPaymentMethods(user);

  // If user wants to use a saved payment method
  if (!finalPaymentMethodId && use_saved && paymentMethods && paymentMethods['subscription']) {
    finalPaymentMethodId = paymentMethods['subscription'].id;
  }

  // If user provides a new payment method and wants to save it
  if (finalPaymentMethodId && save_payment_method) {
    await getOrUpdateUserPaymentMethods(user, { id: finalPaymentMethodId }, 'subscription');
  }

  try {
    const subscription = await stripeClient.subscriptions.create({
      customer: user.stripe_id,
      items: [{ price: price_id }],
      default_payment_method: finalPaymentMethodId,
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: save_payment_method ? 'on_subscription' : 'off',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // Find the latest unpaid contribution for this user and Mahber
    const contribution = await MahberContribution.findOne({
      where: {
        mahber_id: mahberId,
        member_id: req.user.id,
        status: 'unpaid'
      },
      order: [['period_number', 'DESC']]
    });

    // Record payment in payments table (mahber_payments)
    if (contribution) {
      await Payment.create({
        stripe_payment_id: subscription.id,
        receipt_url: '', // You can update this after payment confirmation
        method: 'subscription',
        contribution_id: String(contribution.id),
        mahber_id: String(mahber.id),
        member_id: req.user.id,
        amount: 0, // You can update this after payment confirmation
        status: 'pending'
      });
    }

    res.json({
      subscriptionId: subscription.id,
      clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      paymentMethods
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ message: 'Failed to create subscription: ' + error });
  }
};

// Unsubscribe from Mahber subscription
// remove stripe subscription id from member record
export const unsubscribeFromMahberSubscription = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahberId = Number(req.params.id);
  const member = await Member.findOne({
    where: {
      member_id: String(req.user.id),
      edir_id: String(mahberId),
      // status: 'accepted'
    }
  });
  if (!member || !member.stripe_subscription_id) {
    res.status(400).json({ message: 'No active Stripe subscription found for this member and Mahber.' });
    return;
  }
  try {
    // Cancel the Stripe subscription
    await stripeClient.subscriptions.cancel(String(member.stripe_subscription_id));
    // Optionally, clear the subscription ID from the member record
    await member.update({ stripe_subscription_id: '' });
    res.json({ message: 'Successfully unsubscribed from Mahber Stripe subscription.' });
  } catch (error: any) {
    console.error('Error unsubscribing from Stripe subscription:', error);
    res.status(500).json({ message: error.message || 'Failed to unsubscribe from Stripe subscription.' });
  }
};

/**
 * Get payment reports for the authenticated user (paginated, descending order).
 * Query params:
 *   - page: number (default 1)
 *   - perPage: number (default 10)
 */
export const getUserPaymentReports = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const { mahber_id, page = 1, perPage = 10 } = req.query;
  try {
    // Find all contributions for this user, optionally filter by mahber_id
    let contributionWhere: any = { member_id: req.user.id };
    if (mahber_id) {
      contributionWhere.mahber_id = String(mahber_id); // Ensure string for comparison
    }
    const contributions = await MahberContribution.findAll({ where: contributionWhere });
    const contributionIds = contributions.map(c => String(c.id));

    // Find payments for these contributions
    const paymentWhere: any = {};
    if (contributionIds.length > 0) {
      paymentWhere.contribution_id = { [Op.in]: contributionIds };
    } else {
      // If no contributions, return empty result
      res.json({
        data: [],
        total: 0,
        page: Number(page),
        perPage: Number(perPage)
      });
      return;
    }

    const { rows, count } = await Payment.findAndCountAll({
      where: paymentWhere,
      offset: (Number(page) - 1) * Number(perPage),
      limit: Number(perPage),
      order: [['id', 'DESC']]
    });

    // Fetch Mahber and User info for each payment
    const mahberIds = Array.from(new Set(contributions.map(c => c.mahber_id))).filter((id): id is number => typeof id === 'number');
    console.log('Mahber IDs:', mahberIds);
    const mahbers = await Mahber.findAll({ where: { id: { [Op.in]: mahberIds } } });
    const mahberMap = new Map(mahbers.map(m => [m.id, m.name]));
    console.log('Mahber Map:', mahberMap);
    const contributionMap = new Map(contributions.map(c => [c.id, c.mahber_id]));
    console.log('Contribution Map:', contributionMap);

    const user = await User.findByPk(req.user.id);

    const data = rows.map(p => {
      const mahberId = contributionMap.get(Number(p.contribution_id));
      return {
        ...p.toJSON(),
        mahber_id: typeof mahberId === 'number' ? mahberId : null,
        mahber_name: typeof mahberId === 'number' ? mahberMap.get(mahberId) || null : null,
        user_name: user ? user.full_name : null,
        user_email: user ? user.email : null
      };
    });

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
 * Get all payment reports for a Mahber (paginated, descending order).
 * Query params: page, perPage
 * Only accessible by Mahber admin/creator (check in route/controller).
 */
export const getMahberPaymentReports = async (req: AuthenticatedRequest, res: Response) => {
  const mahberId = Number(req.params.mahber_id);
  logger.info(`Request Params: ${JSON.stringify(req.query)}`);
  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), String(mahberId)))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can view payment reports.' });
    return;
  }

  const { page = 1, perPage = 10 } = req.query;
  try {
    // const payments = await Payment.findAll({ where: { mahber_id: mahberId } });

    const { rows, count } = await Payment.findAndCountAll({
      where: { mahber_id: String(mahberId) } ,
      offset: (Number(page) - 1) * Number(perPage),
      limit: Number(perPage),
      order: [['id', 'DESC']]
    });

    const userIds = Array.from(new Set(rows.map(p => p.member_id))).filter(Boolean);
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } } });
    const userMap = new Map(users.map(u => [u.id, { name: u.full_name, email: u.email }]));

    const data = rows.map(p => ({
      ...p.toJSON(),
      mahber_id: mahberId,
      user_name: typeof p.member_id === 'number' ? userMap.get(p.member_id)?.name || null : null,
      user_email: typeof p.member_id === 'number' ? userMap.get(p.member_id)?.email || null : null
    }));

    res.json({ data, total: count, page: Number(page), perPage: Number(perPage) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get current month payment reports for a Mahber (paginated, descending order).
 * Query params: page, perPage
 * Only accessible by Mahber admin/creator (check in route/controller).
 */
export const getMahberCurrentMonthPayments = async (req: AuthenticatedRequest, res: Response) => {
  const mahberId = Number(req.params.mahber_id);
  if (!req.user || !(await isAdminOfMahber(req.user.id.toString(), String(mahberId)))) {
    res.status(403).json({ message: 'Forbidden: Only Mahber admins can view current month payments.' });
    return;
  }

  const { page = 1, perPage = 10 } = req.query;
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  try {
    // const contributions = await MahberContribution.findAll({
    //   where: {
    //     mahber_id: mahberId,
    //     period_start_date: { [Op.gte]: firstDay, [Op.lte]: lastDay }
    //   }
    // });
    // const contributionIds = contributions.map(c => c.id);

    const { rows, count } = await Payment.findAndCountAll({
      where: { 
        mahber_id: String(mahberId),
        created_at: {
          [Op.gte]: firstDay,
          [Op.lte]: lastDay
        }
      },
      offset: (Number(page) - 1) * Number(perPage),
      limit: Number(perPage),
      order: [['id', 'DESC']]
    });

    const userIds = Array.from(new Set(rows.map(p => p.member_id))).filter(Boolean);
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } } });
    const userMap = new Map(users.map(u => [u.id, { name: u.full_name, email: u.email }]));

    const data = rows.map(p => ({
      ...p.toJSON(),
      mahber_id: mahberId,
      user_name: typeof p.member_id === 'number' ? userMap.get(p.member_id)?.name || null : null,
      user_email: typeof p.member_id === 'number' ? userMap.get(p.member_id)?.email || null : null
    }));

    res.json({ data, total: count, page: Number(page), perPage: Number(perPage) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};