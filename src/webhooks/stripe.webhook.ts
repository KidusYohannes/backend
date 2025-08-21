import { Request, Response } from 'express';
import Stripe from 'stripe';
import { Payment } from '../models/payment.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { Mahber } from '../models/mahber.model';
import { Op } from 'sequelize';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_po6GBW4IGS2AcjaMH59yqdHHU0yssO41';

export const stripeWebhookHandler = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await Payment.findOne({ where: { session_id: session.id } });
        if (payment) {
          await payment.update({ status: 'in_progress' });
        }
        console.log(`Checkout session completed for session ID: ${session.id}`);
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await Payment.findOne({ where: { session_id: session.id } });
        if (payment) {
          await payment.update({ status: 'in_progress' });
        }
        console.log(`Checkout session completed for session ID: ${session.id}`);
        break;
      }

      
      case 'payment_intent.processing': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const payment = await Payment.findOne({ where: { stripe_payment_id: paymentIntent.id } });
        if (payment) {
          await payment.update({ status: 'processing' });
          await MahberContribution.update(
            { status: 'processing' },
            { where: { id: payment.contribution_id } }
          );
        }
        console.log(`Payment intent processing for ID: ${paymentIntent.id}`);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const payment = await Payment.findOne({ where: { stripe_payment_id: paymentIntent.id } });
        if (payment) {
          await payment.update({ status: 'paid' });
          await MahberContribution.update(
            { status: 'paid', amount_paid: payment.amount },
            { where: { id: payment.contribution_id } }
          );
        }
        console.log(`Payment intent succeeded for ID: ${paymentIntent.id}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const payment = await Payment.findOne({ where: { stripe_payment_id: paymentIntent.id } });
        if (payment) {
          await payment.update({ status: 'failed' });
          await MahberContribution.update(
            { status: 'failed' },
            { where: { id: payment.contribution_id } }
          );
        }
        console.log(`Payment intent failed for ID: ${paymentIntent.id}`);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await Payment.findOne({ where: { session_id: session.id } });
        if (payment) {
          await payment.update({ status: 'expired' });
          await MahberContribution.update(
            { status: 'expired' },
            { where: { id: payment.contribution_id } }
          );
        }
        console.log(`Checkout session expired for session ID: ${session.id}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string | undefined;
        if (!subscriptionId) {
          console.warn('Invoice does not have a subscription ID.');
          break;
        }
        const payment = await Payment.findOne({ where: { stripe_payment_id: subscriptionId } });
        if (payment) {
          await payment.update({ status: 'paid' });
          await MahberContribution.update(
            { status: 'paid', amount_paid: payment.amount },
            { where: { id: payment.contribution_id } }
          );
        }
        console.log(`Invoice paid for subscription ID: ${subscriptionId}`);
        // If you want to handle invoice payment failure, use a separate event type like 'invoice.payment_failed'
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const mahber = await Mahber.findOne({ where: { stripe_account_id: account.id } });
        if (mahber) {
          if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
            await mahber.update({ stripe_status: 'active' });
            console.log(`Mahber ${mahber.id} Stripe account marked as active.`);
          } else {
            await mahber.update({ stripe_status: 'pending' });
            console.log(`Mahber ${mahber.id} Stripe account marked as pending.`);
          }
        } else {
          console.warn(`No Mahber found for Stripe account ID: ${account.id}`);
        }
        break;
      }
    
      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Error processing Stripe webhook event:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};