import cron from "node-cron";
import { checkMahberStripeAccount } from "./mahber.service";
import { Mahber } from "../models/mahber.model";
import { Member } from "../models/member.model";
import { Op, WhereOptions } from "sequelize";
import Stripe from "stripe";
import { Payment } from "../models/payment.model";
import { MahberContribution } from "../models/mahber_contribution.model";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });
 /**
  * Scheduler to check Stripe accounts for Mahbers
  * This runs every 2 hours at minute 0.
  * It checks for Mahbers that have a Stripe account ID but are not active
  * and calls the checkMahberStripeAccount function to verify their status.
  */
cron.schedule('* * * * *', async () => {
  console.log('Running Scheduler to check Stripe accounts for Mahbers...');
  // call your service logic here

  const whereClause: WhereOptions = {
    stripe_account_id: {
      [Op.not]: '' // Mahbers that have a Stripe account ID
    },
    [Op.or]: [
      { stripe_status: { [Op.ne]: 'active' } }, // Not active
      { stripe_status: { [Op.is]: null } }      // Or null
    ]
  };
  const mahbers = await Mahber.findAll({
    where: { ...whereClause }
  });
  console.log(`Found ${mahbers.length} mahbers to check.`);
  for (const mahber of mahbers) {
    console.log(`Checking Stripe account for mahber ${mahber.name}...`);
    await checkMahberStripeAccount(mahber.id);
  }
  console.log('Scheduled mahber stripe status check completed.', Date.now());
});

/**
 * | Expression    | Meaning                  |
 * | ------------- | ------------------------ |
 * | `* * * * *`   | Every minute             |
 * | `0 * * * *`   | Every hour at minute 0   |
 * | `0 0 * * *`   | Every day at midnight    |.
 * | `5 * * * *`   | Every 5 minutes          |
 * | `0 0 * * 0`   | Every Sunday at midnight |
 * | `0 0 1 * *`   | First day of every month |
 * | `0 0 1 1 *`   | First day of every year |
 * | `0 0 * * 1-5` | Every weekday at midnight|
 * | `0 0 * * 6,0` | Every weekend at midnight|
 * | `0 0 1-7 * *` | First 7 days of every month |
 * | `0 0 1-7 * 1-5` | First 7 days of every month on weekdays |
 * | `0 0 * * 1-5` | Every weekday at midnight |
 * | `0 0 * * 6,0` | Every weekend at midnight |
 * | `0 0 1-7 * *  | First 7 days of every month |
 * | `0 0 1-7 * 1-5` | First 7 days of every month on weekdays |
 * | `0 0 * * 1-5` | Every weekday at midnight |
 * | `0 0 * * 6,0` | Every weekend at midnight |
 * | `0 0 1-7 * *` | First 7 days of every month |
 * | `0 0 1-7 * 1-5` | First 7 days of every month on weekdays |
 * | `0 0 * * 1-5` | Every weekday at midnight |
 * | `0 0 * * 6,0` | Every weekend at midnight |
 * | `0 0 1-7 * *` | First 7 days of every month |
 * | `0 0 1-7 * 1-5` | First 7 days of every month on weekdays |
 * | `0 0 * * 1-5` | Every weekday at midnight |
 * | `0 0 * * 6,0` | Every weekend at midnight |
 * | `0 0 1-7 * * *` | First 7 days of every month |
 * | `0 0 1-7 * 1-5` | First 7 days of every month on weekdays |
 * | `0 0 * * 1-5` | Every weekday at midnight |
 * | `0 0 * * 6,0` | Every weekend at midnight |
 * | `0 0 1-7 * *` | First 7 days of every month |
 * | `0 0 1-7 * 1-5` | First 7 days of every month on weekdays |
 * | `0 0 * * 1-5` | Every weekday at midnight |
 * | `0 0 * * 6,0` | Every weekend at midnight |
 * | `0 0 1-7 * *` | First 7 days of every month |
 * | `0 0 1-7 * 1-5` | First 7 days of every month on weekdays |
 * | `0 0 * * * 1-5` | Every weekday at midnight |
 * | `0 0 * * * 6,0` | Every weekend at midnight |
 * | `0 0 1-7 * *` | First 7 days of every month |
 * | `0 0 1-7 * 1-5` | First 7 days of every month on weekdays |

 */

/**
 * Scheduler to ensure Stripe product and price IDs exist for Mahbers
 * This runs every 2 hours at minute 0.
 * It checks for Mahbers that are missing Stripe product or price IDs and creates them if necessary
 * It also updates the Mahber model with the new product/price IDs.
 */
cron.schedule('0 */2 * * *', async () => {
  console.log('Running scheduled Stripe product/price check...');
  const WhereOptions: WhereOptions = {
    [Op.or]: [
        { stripe_product_id: { [Op.is]: null } },
        { stripe_product_id: '' },
        { stripe_price_id: { [Op.is]: null } },
        { stripe_price_id: '' }
      ]
  };
  const mahbers = await Mahber.findAll({
    where: {
      ...WhereOptions
    }
  });
  console.log(`Found ${mahbers.length} mahbers missing product/price.`);

  for (const mahber of mahbers) {
    let updatedFields: any = {};

    // Create product if missing
    if (!mahber.stripe_product_id) {
      const product = await stripe.products.create({
        name: mahber.name,
        metadata: {
          contribution_unit: mahber.contribution_unit || '',
          contribution_frequency: mahber.contribution_frequency || '',
          contribution_amount: mahber.contribution_amount || '',
          contribution_start_date: mahber.contribution_start_date || '',
          affiliation: mahber.affiliation || ''
        }
      });
      updatedFields.stripe_product_id = product.id;
    }

    // Create price if missing
    if (!mahber.stripe_price_id) {
      // Use product id from above or existing
      const validIntervals = ['day', 'week', 'month', 'year'];
      const productId = updatedFields.stripe_product_id || mahber.stripe_product_id;
      let interval = mahber.contribution_unit ?? '';
      const interval_count = mahber.contribution_frequency;
      if (!validIntervals.includes(interval)) {
        console.warn(`Invalid contribution unit "${interval}" for Mahber ${mahber.name}. Skipping price creation.`);
        continue;
        // interval = 'month'; // Default to month if invalid (unreachable after continue)
      }
      const recurring = {
        interval: interval as Stripe.Price.Recurring.Interval,
        interval_count: Number(interval_count)
      };
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(Number(mahber.contribution_amount) * 100),
        currency: 'usd',
        recurring
      });
      updatedFields.stripe_price_id = price.id;
    }

    if (Object.keys(updatedFields).length > 0) {
      await mahber.update(updatedFields);
      console.log(`Updated Mahber ${mahber.name} with Stripe product/price.`);
    }
  }
  console.log('Scheduled Stripe product/price check completed.', Date.now());
});

/**
 * Scheduler to sync Stripe subscription ID for members every 2 hours
 * This ensures that any new subscriptions created via Stripe Checkout are reflected in the Member model
 * This is useful for cases where members subscribe to a plan that requires recurring payments.
 * It runs every 2 hours at minute 0.
 */
cron.schedule('0 */2 * * *', async () => {
  console.log('Running scheduled Stripe subscription sync for members...');
  const WhereOptions: WhereOptions = {
    stripe_session_id: { [Op.not]: null },
      stripe_subscription_id: { [Op.or]: [null, ''] }
  }
  const members = await Member.findAll({
    where: {
      ...WhereOptions
    }
  });

  for (const member of members) {
    try {
      const session = await stripe.checkout.sessions.retrieve(member.stripe_session_id as string);
      const subscriptionId = session.subscription as string | null;
      if (subscriptionId) {
        await member.update({ stripe_subscription_id: subscriptionId });
        console.log(`Updated member ${member.id} with subscription ID ${subscriptionId}`);
      } else {
        console.warn(`No subscription found for session ${member.stripe_session_id} (member ${member.id})`);
      }
    } catch (err) {
      console.error(`Error syncing subscription for member ${member.id}:`, err);
    }
  }
  console.log('Scheduled Stripe subscription sync completed.', Date.now());
});

/**
 * Scheduler to get the last payment details for subscription payments
 * This runs every 1 hour at minute 0.
 * It checks for members with active subscriptions and retrieves their latest paid invoice and charge
 * to ensure that their subscription status and payment info are up-to-date.
 */
cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled Stripe subscription payment sync...');
  const whereClause: WhereOptions = {
    stripe_subscription_id: { [Op.not]: null },
    status: 'accepted'
  };
  // Get all members with active subscriptions
  const members = await Member.findAll({
    where: {
      ...whereClause
    }
  });

  for (const member of members) {
    try {
      const subscription = await stripe.subscriptions.retrieve(member.stripe_subscription_id as string);
      if (subscription.status === 'active') {
        // Get the latest paid invoice for this subscription
        const invoices = await stripe.invoices.list({
          subscription: subscription.id,
          limit: 1,
          status: 'paid'
        });
        const invoice = invoices.data[0];
        if (invoice) {
          let receiptUrl = invoice.hosted_invoice_url;
          let paymentId = invoice.id;

          // Check if payment already exists
          const existingPayment = await Payment.findOne({
            where: { stripe_payment_id: paymentId }
          });

          if (!existingPayment) {
            // Find the latest unpaid contribution for this member and mahber
            const contribution = await MahberContribution.findOne({
              where: {
                member_id: member.member_id,
                mahber_id: member.edir_id,
                status: ['pending', 'unpaid']
              },
              order: [['period_number', 'ASC']]
            });

            if (contribution) {
              await Payment.create({
                stripe_payment_id: String(paymentId),
                receipt_url: String(receiptUrl),
                method: 'subscription',
                contribution_id: String(contribution.id),
                member_id: Number(member.member_id),
                amount: Number(invoice.amount_paid) / 100,
                status: 'paid'
              });
              await contribution.update({ status: 'paid', amount_paid: Number(invoice.amount_paid) / 100 });
              console.log(`Created payment record for member ${member.id}, contribution ${contribution.id}`);
            } else {
              console.log(`No unpaid contribution found for member ${member.id}, mahber ${member.edir_id}`);
            }
          } else {
            console.log(`Payment ${paymentId} already recorded for member ${member.id}`);
          }
        } else {
          console.log(`No paid invoices found for subscription ${subscription.id} (member ${member.id})`);
        }
      }
    } catch (err) {
      console.error(`Error syncing payment for member ${member.id}:`, err);
    }
  }
  console.log('Scheduled Stripe subscription payment sync completed.', Date.now());
});

/**
 * Scheduler to sync Stripe one time payments
 * This runs every 5 minutes.
 * It checks for members with one-time payments and retrieves their latest paid invoice and charge
 * to ensure that their payment info is up-to-date.
 */
cron.schedule('* * * * *', async () => {
  console.log('Running scheduled Stripe one-time payment sync...');

  const payments = await Payment.findAll({
    where: {
      method: 'one-time',
      status: 'pending'
    }
  });

  for (const payment of payments) {
    const session = await stripe.checkout.sessions.retrieve(
      payment.stripe_payment_id,
      {
        expand: ['payment_intent', 'subscription'],
      }
    );
    if (session.payment_intent) {
      const paymentIntent = session.payment_intent as Stripe.PaymentIntent;
      console.log(`Processing payment intent ${paymentIntent.id} for session ${session.id}`);
      console.log(`Payment intent status: ${paymentIntent.status}`);

      let receiptUrl = session.url || null;
      if (paymentIntent.id) {
        const chargesList = await stripe.charges.list({ payment_intent: paymentIntent.id, limit: 1 });
        if (chargesList.data.length > 0) {
          receiptUrl = chargesList.data[0].receipt_url || receiptUrl;
        }
      }
      console.log(`Receipt URL: ${receiptUrl}`);

      // Parse contribution_id(s) from payment
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

      // If payment succeeded, update payment and contributions as paid
      if (paymentIntent.status === 'succeeded' && (receiptUrl || '').trim() !== '' && receiptUrl) {
        await Payment.update(
          { status: 'paid', receipt_url: receiptUrl || '', stripe_payment_id: paymentIntent.id },
          { where: { id: payment.id } }
        );
        if (contributionIds.length > 0) {
          await MahberContribution.update(
            { status: 'paid', amount_paid: payment.amount },
            { where: { id: { [Op.in]: contributionIds } } }
          );
        }
        console.log(`Updated payment ${payment.id} and contributions [${contributionIds.join(',')}] to paid.`);
      } else if (
        paymentIntent.status === 'canceled' ||
        paymentIntent.status === 'requires_payment_method' ||
        paymentIntent.status === 'requires_action' ||
        paymentIntent.status === 'requires_confirmation'
      ) {
        // If payment failed or was canceled, update payment and contributions as failed
        await Payment.update(
          { status: 'failed', receipt_url: receiptUrl || '', stripe_payment_id: paymentIntent.id },
          { where: { id: payment.id } }
        );
        if (contributionIds.length > 0) {
          await MahberContribution.update(
            { status: 'failed' },
            { where: { id: { [Op.in]: contributionIds } } }
          );
        }
        console.log(`Updated payment ${payment.id} and contributions [${contributionIds.join(',')}] to failed.`);
      } else {
        console.log(`Payment intent ${paymentIntent.id} not succeeded or failed yet.`);
      }
    }
  }

  console.log('Scheduled Stripe one-time payment sync completed.', Date.now());
});