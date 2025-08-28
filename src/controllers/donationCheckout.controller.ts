import { Response } from 'express';
import dotenv from 'dotenv';
import { getUserById, updateUser } from '../services/user.service';
import { getMahberById } from '../services/mahber.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Payment } from '../models/payment.model';
import logger from '../utils/logger';
import stripeClient from '../config/stripe.config';
import { log } from 'console';

dotenv.config();
const generatedSessionId = generateUniquePaymentId();

function generateUniquePaymentId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


export const createDonationPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info(`Received createDonationPayment request: ${JSON.stringify(req.body)}`);
    if (!req.user) {
      logger.error('Unauthorized request: User not authenticated');
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const mahberId = Number(req.params.id);
    const mahber = await getMahberById(mahberId);
    if (!mahber) {
      logger.error(`Mahber not found for ID: ${mahberId}`);
      res.status(404).json({ message: 'Mahber not found' });
      return;
    }
    if (!mahber.stripe_account_id || mahber.stripe_status !== 'active') {
      logger.error(`Mahber Stripe account is not active for ID: ${mahberId}`);
      res.status(400).json({ message: 'Mahber Stripe account is not active. Please finish onboarding before accepting donations.' });
      return;
    }

    const user = await getUserById(req.user.id);
    if (!user) {
      logger.error(`User not found for ID: ${req.user.id}`);
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { amount, description, currency = 'usd' } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      logger.error('Invalid donation amount');
      res.status(400).json({ message: 'Invalid donation amount' });
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

    logger.info(`Creating Stripe Checkout session for donation: ${JSON.stringify({ amount, description, currency })}`);
    const success_url = `${process.env.FRONTEND_URL || 'https://yenetech.com'}/stripe/success`;
    const cancel_url = `${process.env.FRONTEND_URL || 'https://yenetech.com'}/stripe/cancel`;

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'],
      mode: 'payment',
      customer: user.stripe_id,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: description || 'Donation' },
            unit_amount: amount
          },
          quantity: 1
        }
      ],
      success_url: `${success_url}?mahber_id=${mahber.id}&user_id=${req.user.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancel_url}?mahber_id=${mahber.id}&user_id=${req.user.id}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        mahber_id: mahber.id.toString(),
        user_id: req.user.id.toString(),
        payment_type: 'donation'
      },
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

    logger.info(`Stripe Checkout session created: ${JSON.stringify(session.id)}`);


    // Record the payment in the database
    await Payment.create({
      stripe_payment_id: String(generatedSessionId),
      receipt_url: String(session.url) ?? '',
      method: 'one-time',
      contribution_id: 'donation', // No contribution ID for donations
      member_id:  Number(req.user?.id) ?? '',
      amount: amount,
      session_id: String(session.id),
      status: 'processing'
    });

    logger.info('Stripe Checkout session created successfully for donation');
    res.json({ url: session.url });
    return;
  } catch (error: any) {
    logger.error(`Stripe Donation Checkout error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to create donation checkout session' });
  }
};
