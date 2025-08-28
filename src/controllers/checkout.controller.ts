// checkout controller

import { Response, Request } from 'express';
import dotenv from 'dotenv';
import { getUserById, updateUser } from '../services/user.service';
import { getMahberById } from '../services/mahber.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { saveStripeSessionId, saveStripeSubscriptionId } from '../models/member.model';
import { Payment } from '../models/payment.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { Op, WhereOptions, QueryTypes } from 'sequelize';
import sequelize from '../config/db'; // Adjust the path to your actual Sequelize instance
import logger from '../utils/logger';
import stripeClient from '../config/stripe.config';

dotenv.config();
const CHECKOUT_EXPIRES_AT = Math.floor(Date.now() / 1000) + 60 * 30; // make this 30 minutes
const generatedSessionId = uuidv4();
// Helper to validate Mahber and user
async function validateMahberAndUser(mahberId: number, userId: number) {
  logger.info(`Validating Mahber ID: ${mahberId}, User ID: ${userId}`);
  const mahber = await getMahberById(mahberId);
  if (!mahber) {
    logger.error(`Mahber not found for ID: ${mahberId}`);
    throw new Error('Mahber not found');
  }
  if (!mahber.stripe_account_id || mahber.stripe_status !== 'active') {
    logger.error(`Mahber Stripe account is not active for ID: ${mahberId}`);
    throw new Error('Mahber Stripe account is not active. Please finish onboarding before making payments.');
  }

  const user = await getUserById(userId);
  if (!user) {
    logger.error(`User not found for ID: ${userId}`);
    throw new Error('User not found');
  }

  logger.info(`Mahber and User validated successfully: Mahber ID: ${mahberId}, User ID: ${userId}`);
  return { mahber, user };
}

// Helper to ensure Stripe customer exists
async function ensureStripeCustomer(user: any) {
  if (!user.stripe_id) {
    const stripeCustomer = await stripeClient.customers.create({
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
  logger.info(`Validating contribution IDs: ${contributionIds}`);
  if (contributionIds.length > 0) {
    const paidCount = await MahberContribution.count({
      where: {
        id: { [Op.in]: contributionIds },
        status: 'paid'
      }
    });
    if (paidCount > 0) {
      logger.error(`One or more contributions are already paid: ${contributionIds}`);
      throw new Error('One or more contributions are already paid.');
    }
  }
  logger.info(`Contribution IDs validated successfully: ${contributionIds}`);
}

// Helper to create Stripe Checkout session
async function createStripeSession(paymentType: string, stripeCustomerId: string, mahber: any, req: AuthenticatedRequest, contributionIds: any, sessionData: any) {
  const { expires_at, line_items, subscription_data, payment_intent_data } = sessionData;

  const baseFrontendUrl = process.env.FRONTEND_URL || 'https://yenetech.com';
  const success_url = `${baseFrontendUrl}/stripe/success`;
  const cancel_url = `${baseFrontendUrl}/stripe/cancel`;
    
  const session = await stripeClient.checkout.sessions.create({
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
      // contribution_ids: contributionIds.map(String), // Ensure IDs are strings
      session_id: `{CHECKOUT_SESSION_ID}`,
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
      { status: 'processing' },
      { where: { id: { [Op.in]: contributionIds } } }
    );
    const receipt_url = session.url ?? null;
    const contributionIdString = contributionIds.join(','); // Combine contribution IDs into a comma-separated string
    await Payment.create({
      stripe_payment_id: generatedSessionId,
      receipt_url: String(receipt_url),
      method: paymentType === 'subscription' ? 'subscription' : 'one-time',
      contribution_id: contributionIdString,
      member_id: Number(req.user?.id) ?? '',
      amount,
      session_id: String(session.id),
      status: 'processing'
    });
  }
}

// Helper to find an active session
async function findActiveSession(userId: number, contributionIds: number[], paymentType: string) {
  logger.info(`Finding active session for User ID: ${userId}, Contribution IDs: ${contributionIds}, Payment Type: ${paymentType}`);
  const now = Math.floor(Date.now() / 1000);
  const tenMinutesFromNow = now + 10 * 60; // 10 minutes

  const contributionIdString = contributionIds.join(','); // Combine contribution IDs into a comma-separated string

  const whereOptions: WhereOptions<Payment> = {
    member_id: userId,
    contribution_id: contributionIdString,
    method: paymentType === 'subscription' ? 'subscription' : 'one-time',
  };

  logger.debug(`Sequelize where condition: ${JSON.stringify(whereOptions)}`);

  const activeSession = await Payment.findOne({
    where: whereOptions,
    order: [['id', 'DESC']],
    logging: (query) => logger.debug(`Sequelize query: ${query}`) // Logs the actual query executed by Sequelize
  });

  if (activeSession) {
    logger.info(`Active session found: ${JSON.stringify(activeSession)}`);
    if (typeof activeSession.session_id === 'string') {
      const session = await stripeClient.checkout.sessions.retrieve(activeSession.session_id);
      if (session && session.status === 'open' && session.expires_at > tenMinutesFromNow) {
        logger.info(`Returning active session: ${session.id}`);
        return session;
      }
    }
  }

  logger.info('No active session found');
  return null;
}

export const createCheckoutPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info(`Received createCheckoutPayment request: ${JSON.stringify(req.body)}`);
    if (!req.user) {
      logger.error('Unauthorized request: User not authenticated');
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
    logger.info(`Parsed contribution IDs: ${contributionIds}`);

    if (contributionIds.length > 0) {
      await validateContributionIds(contributionIds);
    }

    if (paymentType !== 'subscription' && contributionIds.length > 0) {
      // Check for an active session
      const activeSession = await findActiveSession(req.user.id, contributionIds, paymentType);
      if (activeSession) {
        logger.info(`Returning existing active session URL: ${activeSession.url}`);
        return res.json({ url: activeSession.url });
      }
    }

    const baseFrontendUrl = process.env.FRONTEND_URL || 'https://yenetech.com';
    const success_url = `${baseFrontendUrl}/stripe/success`;
    const cancel_url = `${baseFrontendUrl}/stripe/cancel`;
    console.log('Stripe Checkout URLs:', { success_url, cancel_url });

    // Common session data
    const sessionData = {
      success_url,
      cancel_url,
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
        },
        payment_intent_data: {
          metadata: {
            session_id: generatedSessionId,
          }
        }
      });


      logger.info(`Stripe Checkout session created updating member: ${JSON.stringify(session.id)}`);

      try {
        await saveStripeSessionId(String(req.user.id), String(mahber.id), String(session.id));
        logger.info(`Saved Stripe session ID ${session.id} for member ${req.user.id} and mahber ${mahber.id}`);
      } catch (error) {
        logger.info(`Failed Stripe session ID ${session.id} for member ${req.user.id} and mahber ${mahber.id}`);
        logger.error(`Failed to save Stripe session ID: ${error}`);
      }
      // Save subscription ID in the Member table
      const subscriptionId = session.subscription;
      if (subscriptionId) {
        const updatedMember = await saveStripeSubscriptionId(String(req.user.id), String(mahber.id), String(subscriptionId));
        console.log(`Updated member ${updatedMember ? req.user.id : 'unknown'} with subscription ID ${String(subscriptionId)}`);
      }
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
          },
          metadata: {
            session_id: generatedSessionId,
          }
        }
      });
    }

      // If no contribution IDs are provided, create a payment record without linking to contributions
      if (contributionIds.length === 0) {
        await Payment.create({
          stripe_payment_id: generatedSessionId,
          receipt_url: String(session.url) ?? '',
          method: paymentType === 'subscription' ? 'subscription' : 'one-time',
          contribution_id: '', // No contribution ID
          member_id: Number(req.user?.id) ?? '',
          amount,
          session_id: String(session.id),
          status: 'processing'
        });
      }

    if (contributionIds.length > 0) {
      await handlePendingPaymentsAndContributions(contributionIds, session, req, paymentType, amount || 0);
    }

    logger.info('Stripe Checkout session created successfully');
    return res.json({ url: session.url });
  } catch (error: any) {
    logger.error(`Stripe Checkout error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to create checkout session' });
  }
};
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

