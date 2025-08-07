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

export const createCheckoutPayment = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const mahberId = Number(req.params.id);
  const paymentType = req.params.payment_type || 'one_time'; // 'one_time' or 'subscription'
  const mahber = await getMahberById(mahberId);
  if (!mahber) {
    return res.status(404).json({ message: 'Mahber not found' });
  }
  if (!mahber.stripe_account_id || mahber.stripe_status !== 'active') {
    return res.status(400).json({ message: 'Mahber Stripe account is not active. Please finish onboarding before making payments.' });
  }

  const user = await getUserById(Number(req.user.id));
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  let stripeCustomerId = user.stripe_id;
  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: user.full_name,
      phone: user.phone
    });
    await updateUser(user.id, { stripe_id: stripeCustomer.id });
    stripeCustomerId = stripeCustomer.id;
  }

  // Common URLs
  const success_url = process.env.SUCCESS_URL || 'https://yenetech.com/stripe/success';
  const cancel_url = process.env.CANCEL_URL || 'https://yenetech.com/stripe/cancel';

  try {
    if (paymentType === 'subscription') {
      const { price_id, description, contribution_id } = req.body;
      if (!price_id) {
        return res.status(400).json({ message: 'Missing price_id for subscription' });
      }

      // Parse contribution_id(s)
      let contributionIds: number[] = [];
      if (typeof contribution_id === 'string' && contribution_id.trim() !== '') {
        contributionIds = contribution_id.split(',').map((id: string) => Number(id.trim())).filter(Boolean);
      } else if (typeof contribution_id === 'number') {
        contributionIds = [contribution_id];
      }

      // If contribution_id(s) provided, check if any are already paid
      if (contributionIds.length > 0) {
        const paidCount = await MahberContribution.count({
          where: {
            id: { [Op.in]: contributionIds },
            status: 'paid'
          }
        });
        if (paidCount > 0) {
          return res.status(400).json({ message: 'One or more contributions are already paid.' });
        }
      }

      // Stripe Checkout Session for subscription (ACH and Card)
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'us_bank_account'],
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [
          {
            price: price_id,
            quantity: 1
          }
        ],
        subscription_data: {
          transfer_data: {
            destination: mahber.stripe_account_id,
          }
        },
        success_url,
        cancel_url,
        // customer_email: user.email
      });
      // Save session ID to member row
      await saveStripeSessionId(String(mahberId), String(req.user.id), session.id);

      // Optionally, update contribution status to pending if contribution_id(s) provided
      if (contributionIds.length > 0) {
        await MahberContribution.update(
          { status: 'pending' },
          { where: { id: { [Op.in]: contributionIds } } }
        );
        let receipt_url = session.url ?? null;
        for (const cid of contributionIds) {
          await Payment.create({
            stripe_payment_id: String(session.payment_intent || session.id),
            receipt_url: String(receipt_url),
            method: paymentType === 'subscription' ? 'subscription' : 'one-time',
            contribution_id: String(cid),
            member_id: req.user.id,
            amount: req.body.amount,
            status: 'pending'
          });
        }
      }

      return res.json({ url: session.url });
    } else {
      // One-time payment
      const { amount, currency = 'usd', description, contribution_id } = req.body;
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      // Parse contribution_id(s)
      let contributionIds: number[] = [];
      if (typeof contribution_id === 'string' && contribution_id.trim() !== '') {
        contributionIds = contribution_id.split(',').map((id: string) => Number(id.trim())).filter(Boolean);
      } else if (typeof contribution_id === 'number') {
        contributionIds = [contribution_id];
      }

      // If contribution_id(s) provided, check if any are already paid
      if (contributionIds.length > 0) {
        const paidCount = await MahberContribution.count({
          where: {
            id: { [Op.in]: contributionIds },
            status: 'paid'
          }
        });
        if (paidCount > 0) {
          return res.status(400).json({ message: 'One or more contributions are already paid.' });
        }
      }

      // Stripe Checkout Session for one-time payment (ACH and Card)
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'us_bank_account'],
        mode: 'payment',
        customer: stripeCustomerId,
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: description || 'Mahber Contribution'
              },
              unit_amount: amount,
            },
            quantity: 1,
          }
        ],
        payment_intent_data: {
          setup_future_usage: 'off_session',
          transfer_data: {
            destination: mahber.stripe_account_id,
          }
        },
        success_url,
        cancel_url,
        // customer_email: user.email
      });
      // Save session ID to member row
      await saveStripeSessionId(String(mahberId), String(req.user.id), session.id);

      // Find the latest unpaid contribution for this user and Mahber if no contribution_id(s) provided
      let contribution = null;
      if (contributionIds.length === 0) {
        contribution = await MahberContribution.findOne({
          where: {
            mahber_id: mahberId,
            member_id: req.user.id,
            status: 'unpaid'
          },
          order: [['period_number', 'DESC']]
        });
      }

      // Optionally, update contribution status to pending if contribution_id(s) provided
      await MahberContribution.update(
        { status: 'pending' },
        { where: { id: { [Op.in]: contributionIds } } }
      );
      let receipt_url = session.url ?? null;
      await Payment.create({
        stripe_payment_id: String(session.payment_intent || session.id),
        receipt_url: String(receipt_url),
        method: 'one-time',
        contribution_id: contribution_id,
        member_id: req.user.id,
        amount: req.body.amount,
        status: 'pending'
      });
      

      return res.json({ url: session.url });
    }
  } catch (error: any) {
    console.error('Stripe Checkout error:', error);
    res.status(500).json({ message: error.message || 'Failed to create checkout session' });
  }
};
