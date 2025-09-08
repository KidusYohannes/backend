import { Request, Response } from "express";
import { MahberContribution } from "../models/mahber_contribution.model";
import { Payment } from "../models/payment.model";
import logger from '../utils/logger';





export const handlePaymentSuccess = async (req: Request, res: Response) => {
  const { mahber_id, user_id, session_id } = req.query;

  if (!mahber_id || !user_id || !session_id) {
    res.status(400).json({ message: 'mahber_id, user_id, and session_id are required.' });
    return;
  }

  try {
    const payment = await Payment.findOne({
      where: {
        mahber_id: String(mahber_id),
        member_id: Number(user_id),
        session_id: String(session_id),
        status: 'processing'
      }
    });

    if (!payment) {
      res.status(404).json({ message: 'Payment not found or already processed.' });
      return;
    }

    payment.status = 'paid';
    await payment.save();

    if (payment.contribution_id !== 'donation') {
      await MahberContribution.update(
        { status: 'paid', amount_paid: payment.amount },
        { where: { id: payment.contribution_id } }
      );
    }

    res.json({ message: 'Payment successfully processed.', payment });
  } catch (err: any) {
    logger.error(`Error processing donation payment success: ${err.message}`);
    res.status(500).json({ message: 'Failed to process payment success.' });
  }
};

export const handlePaymentCancel = async (req: Request, res: Response) => {
  const { mahber_id, user_id, session_id } = req.query;

  if (!mahber_id || !user_id || !session_id) {
    res.status(400).json({ message: 'mahber_id, user_id, and session_id are required.' });
    return;
  }

  try {
    const payment = await Payment.findOne({
      where: {
        mahber_id: String(mahber_id),
        member_id: Number(user_id),
        session_id: String(session_id),
        status: 'processing'
      }
    });

    if (!payment) {
      res.status(404).json({ message: 'Payment not found or already processed.' });
      return;
    }

    payment.status = 'canceled';
    await payment.save();

    if (payment.contribution_id !== 'donation') {
      await MahberContribution.update(
        { status: 'unpaid' },
        { where: { id: payment.contribution_id } }
      );
    }

    res.json({ message: 'Payment canceled successfully.', payment });
  } catch (err: any) {
    logger.error(`Error processing donation payment cancel: ${err.message}`);
    res.status(500).json({ message: 'Failed to process payment cancel.' });
  }
};
