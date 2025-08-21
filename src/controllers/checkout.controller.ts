// checkout controller

import { Response, Request } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { getUserById, updateUser } from '../services/user.service';
import { getMahberById } from '../services/mahber.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { saveStripeSessionId } from '../models/member.model';
import { Payment } from '../models/payment.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { Op } from 'sequelize';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });
const CHECKOUT_EXPIRES_AT = Math.floor(Date.now() / 1000) + 60 * 30; // make this 30 minutes

// Helper to validate Mahber and user
async function validateMahberAndUser(mahberId: number, userId: number) {
  const mahber = await getMahberById(mahberId);
  if (!mahber) {
    throw new Error('Mahber not found');
  }
  if (!mahber.stripe_account_id || mahber.stripe_status !== 'active') {
    throw new Error('Mahber Stripe account is not active. Please finish onboarding before making payments.');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return { mahber, user };
}

// Helper to ensure Stripe customer exists
async function ensureStripeCustomer(user: any) {
  if (!user.stripe_id) {
    const stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: user.full_name,
      phone: user.phone
    });
    await updateUser(user.id, { stripe_id: stripeCustomer.id });
    user.stripe_id = stripeCustomer.id;
  }
  return user.stripe_id;
}

// Helper to validate contribution IDs
async function validateContributionIds(contributionIds: number[]) {
  if (contributionIds.length > 0) {
    const paidCount = await MahberContribution.count({
      where: {
        id: { [Op.in]: contributionIds },
        status: 'paid'
      }
    });
    if (paidCount > 0) {
      throw new Error('One or more contributions are already paid.');
    }
  }
}

// Helper to create Stripe Checkout session
async function createStripeSession(paymentType: string, stripeCustomerId: string, mahber: any, req: AuthenticatedRequest, sessionData: any, contributionIds: any) {
  const { success_url, cancel_url, expires_at, line_items, subscription_data, payment_intent_data } = sessionData;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'us_bank_account'],
    mode: paymentType === 'subscription' ? 'subscription' : 'payment',
    customer: stripeCustomerId,
    line_items,
    subscription_data,
    payment_intent_data,
    success_url: success_url + `?mahber_id=${mahber.id}&user_id=${req.user?.id ?? ''}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancel_url + `?mahber_id=${mahber.id}&user_id=${req.user?.id ?? ''}&session_id={CHECKOUT_SESSION_ID}`,
    metadata: {
      mahber_id: mahber.id.toString(),
      member_id: req.user?.id?.toString() ?? '',
      contribution_ids: contributionIds.join(','),
      paymentType
    },
    expires_at
  });

  return session;
}

// Helper to handle pending payments and contributions
async function handlePendingPaymentsAndContributions(contributionIds: number[], session: any, req: AuthenticatedRequest, paymentType: string, amount: number) {
  if (contributionIds.length > 0) {
    await MahberContribution.update(
      { status: 'unpaid' },
      { where: { id: { [Op.in]: contributionIds } } }
    );
    let receipt_url = session.url ?? null;
    for (const cid of contributionIds) {
      await Payment.create({
        stripe_payment_id: String(session.payment_intent),
        receipt_url: String(receipt_url),
        method: paymentType === 'subscription' ? 'subscription' : 'one-time',
        contribution_id: String(cid),
        member_id: Number(req.user?.id) ?? '',
        amount,
        session_id: String(session.id),
        status: 'unpaid'
      });
    }
  }
}

// Helper to find an active session
async function findActiveSession(userId: number, contributionIds: number[], paymentType: string) {
  const now = Math.floor(Date.now() / 1000);
  const tenMinutesFromNow = now + 10 * 60; // 10 minutes

  const activeSession = await Payment.findOne({
    where: {
      member_id: userId,
      contribution_id: { [Op.in]: contributionIds },
      method: paymentType,
      status: 'pending'
    },
    order: [['createdAt', 'DESC']]
  });

  if (activeSession) {
    const session = await stripe.checkout.sessions.retrieve(activeSession.stripe_payment_id);
    if (session && session.status === 'open' && session.expires_at > tenMinutesFromNow) {
      return session;
    }
  }

  return null;
}

export const createCheckoutPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const mahberId = Number(req.params.id);
    const paymentType = req.params.payment_type || 'one_time'; // 'one_time' or 'subscription'
    const { mahber, user } = await validateMahberAndUser(mahberId, req.user.id);
    const stripeCustomerId = await ensureStripeCustomer(user);

    const { price_id, description, contribution_id, amount, currency = 'usd' } = req.body;

    // Validate contribution IDs
    let contributionIds: number[] = [];
    if (typeof contribution_id === 'string' && contribution_id.trim() !== '') {
      contributionIds = contribution_id.split(',').map((id: string) => Number(id.trim())).filter(Boolean);
    } else if (typeof contribution_id === 'number') {
      contributionIds = [contribution_id];
    }
    await validateContributionIds(contributionIds);

    // Check for an active session
    const activeSession = await findActiveSession(req.user.id, contributionIds, paymentType);
    if (activeSession) {
      return res.json({ url: activeSession.url });
    }

    // Common session data
    const sessionData = {
      success_url: process.env.SUCCESS_URL || 'https://yenetech.com/stripe/success',
      cancel_url: process.env.CANCEL_URL || 'https://yenetech.com/stripe/cancel',
      expires_at: Math.floor(Date.now() / 1000) + 60 * 30
    };

    let session;
    if (paymentType === 'subscription') {
      if (!price_id) {
        return res.status(400).json({ message: 'Missing price_id for subscription' });
      }
      session = await createStripeSession(paymentType, stripeCustomerId, mahber, req, contributionIds, {
        ...sessionData,
        line_items: [{ price: price_id, quantity: 1 }],
        subscription_data: {
          transfer_data: {
            destination: mahber.stripe_account_id
          }
        }
      });
    } else {
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      session = await createStripeSession(paymentType, stripeCustomerId, mahber, req, contributionIds, {
        ...sessionData,
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: description || 'Mahber Contribution' },
              unit_amount: amount
            },
            quantity: 1
          }
        ],
        payment_intent_data: {
          setup_future_usage: 'off_session',
          transfer_data: {
            destination: mahber.stripe_account_id
          }
        }
      });
    }

    await handlePendingPaymentsAndContributions(contributionIds, session, req, paymentType, amount || 0);

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout error:', error);
    res.status(500).json({ message: error.message || 'Failed to create checkout session' });
  }
};