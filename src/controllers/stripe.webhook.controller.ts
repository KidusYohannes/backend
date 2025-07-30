import { Request, Response } from 'express';
import { MahberContribution } from '../models/mahber_contribution.model';
// import your email service here

export const stripeWebhook = async (req: Request, res: Response) => {
  const event = req.body;
  if (event.type === 'invoice.payment_failed') {
    const subscriptionId = event.data.object.subscription;
    // Find member and contribution by subscriptionId, mark as failed, send email
    // ...your logic here...
  }
  res.sendStatus(200);
};
