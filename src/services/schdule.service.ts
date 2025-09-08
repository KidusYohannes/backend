import cron from "node-cron";
import { checkMahberStripeAccount } from "./mahber.service";
import { Mahber } from "../models/mahber.model";
import { Member } from "../models/member.model";
import { Op, WhereOptions } from "sequelize";
import { Payment } from "../models/payment.model";
import { MahberContribution } from "../models/mahber_contribution.model";
import { MahberContributionTerm } from "../models/mahber_contribution_term.model";
import stripeClient from '../config/stripe.config';
import Stripe from "stripe";
import logger from "../utils/logger";

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
      const product = await stripeClient.products.create({
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
      const price = await stripeClient.prices.create({
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
cron.schedule('* * * * *', async () => {
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
      const session = await stripeClient.checkout.sessions.retrieve(member.stripe_session_id as string);
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
cron.schedule('* * * * *', async () => {
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
      const subscription = await stripeClient.subscriptions.retrieve(member.stripe_subscription_id as string);
      if (subscription.status === 'active') {
        // Get the latest paid invoice for this subscription
        const invoices = await stripeClient.invoices.list({
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
                mahber_id: String(member.edir_id),
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
 * Scheduler to sync Stripe one-time payments
 * This runs every 5 minutes.
 * It checks for payments with one-time method and retrieves their latest status using the session ID.
 */
cron.schedule('* * * * *', async () => {
  console.log('Running scheduled Stripe one-time payment sync...');

  const payments = await Payment.findAll({
    where: {
      method: 'one-time',
      status: 'unpaid'
    }
  });

  for (const payment of payments) {
    try {
      const session = await stripeClient.checkout.sessions.retrieve(payment.session_id as string, {
        expand: ['payment_intent', 'subscription']
      });
      console.log(`Processing session ${session.id}`);
      if (session.payment_intent) {
        const paymentIntent = session.payment_intent as Stripe.PaymentIntent;
        console.log(`Processing payment intent ${paymentIntent.id} for session ${session.id}`);
        console.log(`Payment intent status: ${paymentIntent.status}`);

        let receiptUrl: string = session.url || '';
        if (paymentIntent.id) {
          const chargesList = await stripeClient.charges.list({ payment_intent: paymentIntent.id, limit: 1 });
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
        if (paymentIntent.status === 'succeeded' && receiptUrl) {
          await Payment.update(
            { status: 'paid', receipt_url: receiptUrl, stripe_payment_id: paymentIntent.id },
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
          paymentIntent.status === 'canceled'
        ) {
          /**
           *  ||
            paymentIntent.status === 'requires_payment_method' ||
            paymentIntent.status === 'requires_action' ||
            paymentIntent.status === 'requires_confirmation'
           */
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
    } catch (err) {
      console.error(`Error syncing payment for session ${payment.session_id}:`, err);
    }
  }

  console.log('Scheduled Stripe one-time payment sync completed.', Date.now());
});

/**
 * Helper function to calculate the next period start date based on the contribution term.
 */
function calculateNextPeriodStartDate(currentDate: Date, unit: string, frequency: number): Date {
  const nextDate = new Date(currentDate);
  switch (unit) {
    case "month":
      nextDate.setMonth(nextDate.getMonth() + frequency);
      break;
    case "week":
      nextDate.setDate(nextDate.getDate() + frequency * 7);
      break;
    case "year":
      nextDate.setFullYear(nextDate.getFullYear() + frequency);
      break;
    case "day":
      nextDate.setDate(nextDate.getDate() + frequency);
      break;
    default:
      throw new Error(`Unsupported contribution unit: ${unit}`);
  }
  return nextDate;
}

/**
 * Cron job to create contributions for Mahber members based on the contribution term.
 * Runs every day at midnight.
 */
cron.schedule("0 0 * * *", async () => {
  logger.info("Running scheduled job to create contributions for Mahber members...");

  try {
    // Fetch all active contribution terms
    const contributionTerms = await MahberContributionTerm.findAll({
      where: { status: "active" },
    });

    for (const term of contributionTerms) {
      const { mahber_id, unit, frequency, amount, effective_from } = term;
      const members = await Member.findAll({
        where: { edir_id: mahber_id, status: "accepted" },
      });

      for (const member of members) {
        // Find the latest contribution for the member
        const latestContribution = await MahberContribution.findOne({
          where: { mahber_id, member_id: member.member_id },
          order: [["period_number", "DESC"]],
        });

        let nextPeriodNumber = 1;
        let nextPeriodStartDate = new Date(effective_from);

        if (latestContribution) {
          nextPeriodNumber = (latestContribution.period_number ?? 0) + 1;
          nextPeriodStartDate = calculateNextPeriodStartDate(
            new Date(latestContribution.period_start_date ?? effective_from),
            unit,
            frequency
          );
        }

        // Ensure contributions are created for any missing periods
        const now = new Date();
        const contributionsToCreate = [];
        while (nextPeriodStartDate <= now) {
          contributionsToCreate.push({
            mahber_id,
            member_id: member.member_id,
            period_number: nextPeriodNumber,
            period_start_date: nextPeriodStartDate.toISOString(),
            amount_due: amount,
            contribution_term_id: term.id,
            status: "unpaid",
          });

          nextPeriodNumber++;
          nextPeriodStartDate = calculateNextPeriodStartDate(
            nextPeriodStartDate,
            unit,
            frequency
          );
        }

        if (contributionsToCreate.length > 0) {
          await MahberContribution.bulkCreate(contributionsToCreate);
          logger.info(
            `Created ${contributionsToCreate.length} contributions for member ${member.member_id} in Mahber ${mahber_id}.`
          );
        }
      }
    }

    logger.info("Scheduled job to create contributions completed successfully.");
  } catch (error: any) {
    logger.error(`Error in scheduled job to create contributions: ${error.message}`);
  }
});