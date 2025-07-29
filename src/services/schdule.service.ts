import cron from "node-cron";
import { checkMahberStripeAccount } from "./mahber.service";
import { Mahber } from "../models/mahber.model";
import { Op, WhereOptions } from "sequelize";

cron.schedule('0 0 * * *', async () => {
  console.log('Running scheduled contribution check...');
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
| ------------- | ------------------------ |
| `* * * * *`   | Every minute             |
| `0 * * * *`   | Every hour at minute 0   |
| `0 0 * * *`   | Every day at midnight    |.  */

// "*/5 * * * *" | Every 5 minutes          |
/**
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