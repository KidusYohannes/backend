import { Request, Response } from 'express';
import Stripe from 'stripe';
import { Payment } from '../models/payment.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { Member } from '../models/member.model';
import { Mahber } from '../models/mahber.model';
import { Op } from 'sequelize';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });

/**
 * Stripe webhook handler for payment and onboarding events.
 * Configure your Stripe dashboard to send events to /webhooks/stripe.
 */
export const stripeWebhookHandler = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      'whsec_BZGGZHp50IZdA4Lcje7ZZgNxOPAvHKCt'
    );
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    // One-time payment succeeded
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const payment = await Payment.findOne({ where: { stripe_payment_id: paymentIntent.id } });
      if (payment && payment.status !== 'paid') {
        let receiptUrl = '';
        if (paymentIntent.latest_charge) {
          // Fetch the charge from Stripe using the latest_charge property
          const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string);
          receiptUrl = charge.receipt_url || '';
        }
        await payment.update({ status: 'paid', receipt_url: receiptUrl });
        // Update contributions as paid
        let contributionIds: number[] = [];
        if (payment.contribution_id) {
          if (typeof payment.contribution_id === 'string') {
            contributionIds = payment.contribution_id
              .split(',')
              .map((id: string) => Number(id.trim()))
              .filter(Boolean);
          } else if (typeof payment.contribution_id === 'number') {
            contributionIds = [payment.contribution_id];
          }
        }
        if (contributionIds.length > 0) {
          await MahberContribution.update(
            { status: 'paid', amount_paid: payment.amount },
            { where: { id: { [Op.in]: contributionIds } } }
          );
        }
      }
      break;
    }
    // Subscription payment succeeded (invoice paid)
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as any).subscription as string;
      // Find member by subscription id
      const member = await Member.findOne({ where: { stripe_subscription_id: subscriptionId } });
      if (member) {
        // Find latest unpaid/pending contribution for this member and mahber
        const contribution = await MahberContribution.findOne({
          where: {
            member_id: member.member_id,
            mahber_id: member.edir_id,
            status: ['pending', 'unpaid']
          },
          order: [['period_number', 'ASC']]
        });
        if (contribution) {
          // Create payment record if not exists
          const existingPayment = await Payment.findOne({ where: { stripe_payment_id: invoice.id } });
          if (!existingPayment) {
            await Payment.create({
              stripe_payment_id: String(invoice.id),
              receipt_url: String(invoice.hosted_invoice_url),
              method: 'subscription',
              contribution_id: String(contribution.id),
              member_id: Number(member.member_id),
              amount: Number(invoice.amount_paid) / 100,
              status: 'paid'
            });
          }
          await contribution.update({ status: 'paid', amount_paid: Number(invoice.amount_paid) / 100 });
        }
      }
      break;
    }
    // Onboarding status update (account updated)
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      const mahber = await Mahber.findOne({ where: { stripe_account_id: account.id } });
      if (mahber) {
        if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
          await mahber.update({ stripe_status: 'active' });
        } else {
          await mahber.update({ stripe_status: 'pending' });
        }
      }
      break;
    }
    // Payment failed
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const payment = await Payment.findOne({ where: { stripe_payment_id: paymentIntent.id } });
      if (payment && payment.status !== 'failed') {
        await payment.update({ status: 'failed' });
        // Optionally update contributions as failed
        let contributionIds: number[] = [];
        if (payment.contribution_id) {
          if (typeof payment.contribution_id === 'string') {
            contributionIds = payment.contribution_id
              .split(',')
              .map((id: string) => Number(id.trim()))
              .filter(Boolean);
          } else if (typeof payment.contribution_id === 'number') {
            contributionIds = [payment.contribution_id];
          }
        }
        if (contributionIds.length > 0) {
          await MahberContribution.update(
            { status: 'failed' },
            { where: { id: { [Op.in]: contributionIds } } }
          );
        }
      }
      break;
    }
    // Add more event types as needed
    default:
      // Unhandled event type
      break;
  }

  res.status(200).json({ received: true });
};
