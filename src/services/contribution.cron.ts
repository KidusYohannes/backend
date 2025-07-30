import cron from "node-cron";
import { MahberContribution } from "../models/mahber_contribution.model";
import { Op } from "sequelize";
// import your email service here

cron.schedule('0 8 * * *', async () => {
  // Find unpaid contributions past due date
  const today = new Date().toISOString().slice(0, 10);
  const missed = await MahberContribution.findAll({
    where: {
      status: 'unpaid',
      period_start_date: { [Op.lt]: today }
    }
  });
  for (const contrib of missed) {
    // Send email reminder to member
    // ...your logic here...
  }
});
