import { Request, Response } from 'express';
import { Payment } from '../models/payment.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { Mahber } from '../models/mahber.model';
import { Op } from 'sequelize';
import { Member } from '../models/member.model';
import logger from '../utils/logger';
import stripeClient from '../config/stripe.config';
import Stripe from 'stripe';

const STRIPE_WEBHOOK_SECRET_CONNECTED = 'whsec_nuLjB1f4bWbiG6SXz8YnaqP6QUPRJ58h'; //process.env.STRIPE_WEBHOOK_SECRET || 'whsec_po6GBW4IGS2AcjaMH59yqdHHU0yssO41';
const STRIPE_WEBHOOK_SECRET_PLATFORM = 'whsec_q0ILAlj9diGxfnoARGIfFPHGdzUK3lWH'; //process.env.STRIPE_WEBHOOK_SECRET || 'whsec_po6GBW4IGS2AcjaMH59yqdHHU0yssO41';

export const stripeWebhookHandler = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  logger.info('Stripe webhook received. Verifying signature...');

  try {
    // Try verifying with the connected account secret
    event = stripeClient.webhooks.constructEvent(req.body, sig as string, STRIPE_WEBHOOK_SECRET_CONNECTED);
    logger.info(`Stripe webhook signature verified with connected secret. Event type: ${event.type}`);
  } catch (errConnected: any) {
    try {
      // If verification with connected secret fails, try with the platform secret
      event = stripeClient.webhooks.constructEvent(req.body, sig as string, STRIPE_WEBHOOK_SECRET_PLATFORM);
      logger.info(`Stripe webhook signature verified with platform secret. Event type: ${event.type}`);
    } catch (errPlatform: any) {
      // If both verifications fail, log the error and return a 400 response
      logger.error(`Stripe webhook signature verification failed: ${errConnected.message} | ${errPlatform.message}`);
      res.status(400).send(`Webhook Error: ${errConnected.message} | ${errPlatform.message}`);
      return;
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        logger.info('Handling event: checkout.session.completed');
        const session = event.data.object as Stripe.Checkout.Session;
        logger.debug(`Session data: ${JSON.stringify(session)}`);

        const payment = await Payment.findOne({ where: { session_id: session.id } });
        if (payment) {
          logger.info(`Payment found for session ID: ${session.id}`);
          await payment.update({
            status: 'processing',
            stripe_payment_id: session.payment_intent as string || payment.stripe_payment_id
          });
        } else {
          logger.warn(`No payment found for session ID: ${session.id}`);
        }

        if (session.subscription) {
          const subscriptionId = session.subscription as string;
          const member = await Member.findOne({ where: { stripe_session_id: session.id } });
          if (member) {
            logger.info(`Updating member ${member.id} with subscription ID: ${subscriptionId}`);
            await member.update({ stripe_subscription_id: subscriptionId });
          } else {
            logger.warn(`No member found for session ID: ${session.id}`);
          }
        }

        logger.info(`Checkout session completed for session ID: ${session.id}`);
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        logger.info('Handling event: checkout.session.async_payment_succeeded');
        const session = event.data.object as Stripe.Checkout.Session;
        logger.debug(`Session data: ${JSON.stringify(session)}`);

        const payment = await Payment.findOne({ where: { session_id: session.id } });
        if (payment) {
          logger.info(`Payment found for session ID: ${session.id}`);
          await payment.update({
            status: 'processing',
            stripe_payment_id: session.payment_intent as string || payment.stripe_payment_id
          });
        } else {
          logger.warn(`No payment found for session ID: ${session.id}`);
        }

        logger.info(`Checkout session async payment succeeded for session ID: ${session.id}`);
        break;
      }

      case 'payment_intent.processing': {
        logger.info('Handling event: payment_intent.processing');
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.debug(`PaymentIntent data: ${JSON.stringify(paymentIntent)}`);

        let payment = await Payment.findOne({ where: { stripe_payment_id: paymentIntent.id } });
        if (!payment && paymentIntent.metadata && paymentIntent.metadata.session_id) {
          logger.info(`No payment found by payment_intent ID. Trying session_id: ${paymentIntent.metadata.session_id}`);
          payment = await Payment.findOne({ where: { session_id: paymentIntent.metadata.session_id } });
          if (payment) {
            await payment.update({ stripe_payment_id: paymentIntent.id });
          }
        }

        if (payment) {
          logger.info(`Updating payment status to processing for paymentIntent ID: ${paymentIntent.id}`);
          await payment.update({ status: 'processing' });
          await MahberContribution.update(
            { status: 'processing' },
            { where: { id: payment.contribution_id } }
          );
        } else {
          logger.warn(`No payment found for paymentIntent ID: ${paymentIntent.id}`);
        }

        break;
      }

      case 'payment_intent.succeeded': {
        logger.info('Handling event: payment_intent.succeeded');
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.debug(`PaymentIntent data: ${JSON.stringify(paymentIntent)}`);

        let payment = await Payment.findOne({ where: { stripe_payment_id: paymentIntent.id } });
        if (!payment && paymentIntent.metadata && paymentIntent.metadata.session_id) {
          logger.info(`No payment found by payment_intent ID. Trying session_id: ${paymentIntent.metadata.session_id}`);
          payment = await Payment.findOne({ where: { stripe_payment_id: paymentIntent.metadata.session_id } });
          if (payment) {
            await payment.update({ stripe_payment_id: paymentIntent.id });
          }
        }

        if (payment) {
          logger.info(`Updating payment status to paid for paymentIntent ID: ${paymentIntent.id}`);
          await payment.update({ status: 'paid' });
          await MahberContribution.update(
            { status: 'paid', amount_paid: payment.amount },
            { where: { id: payment.contribution_id } }
          );
        } else {
          logger.warn(`No payment found for paymentIntent ID: ${paymentIntent.id}`);
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        logger.info('Handling event: payment_intent.payment_failed');
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.debug(`PaymentIntent data: ${JSON.stringify(paymentIntent)}`);

        let payment = await Payment.findOne({ where: { stripe_payment_id: paymentIntent.id } });
        if (!payment && paymentIntent.metadata && paymentIntent.metadata.session_id) {
          logger.info(`No payment found by payment_intent ID. Trying session_id: ${paymentIntent.metadata.session_id}`);
          payment = await Payment.findOne({ where: { session_id: paymentIntent.metadata.session_id } });
          if (payment) {
            await payment.update({ stripe_payment_id: paymentIntent.id });
          }
        }

        if (payment) {
          logger.info(`Updating payment status to failed for paymentIntent ID: ${paymentIntent.id}`);
          await payment.update({ status: 'failed' });
          await MahberContribution.update(
            { status: 'failed' },
            { where: { id: payment.contribution_id } }
          );
        } else {
          logger.warn(`No payment found for paymentIntent ID: ${paymentIntent.id}`);
        }

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
        logger.info(`Checkout session expired for session ID: ${session.id}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string | undefined;
        if (!subscriptionId) {
          logger.warn('Invoice does not have a subscription ID.');
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
        logger.info(`Invoice paid for subscription ID: ${subscriptionId}`);
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const mahber = await Mahber.findOne({ where: { stripe_account_id: account.id } });
        if (mahber) {
          if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
            await mahber.update({ stripe_status: 'active' });
            logger.info(`Mahber ${mahber.id} Stripe account marked as active.`);
          } else {
            await mahber.update({ stripe_status: 'pending' });
            logger.info(`Mahber ${mahber.id} Stripe account marked as pending.`);
          }
        } else {
          logger.warn(`No Mahber found for Stripe account ID: ${account.id}`);
        }
        break;
      }
    
      default:
        logger.info(`Unhandled event type: ${event.type}`);
        break;
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    logger.error(`Error processing Stripe webhook event: ${err.message}`, { stack: err.stack });
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};