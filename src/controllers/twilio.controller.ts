import { Request, Response } from 'express';
import * as twilioService from '../services/twilio.service';
import logger from '../utils/logger';

/**
 * Send an individual text message.
 */
export const sendIndividualMessage = async (req: Request, res: Response) => {
  const { to, message } = req.body;

  if (!to || !message) {
    res.status(400).json({ message: 'Recipient phone number and message are required.' });
    return;
  }

  try {
    await twilioService.testMessage(message, to, '+15017122661');
    res.status(200).json({ message: 'Message sent successfully.' });
  } catch (error: any) {
    logger.error(`Error sending individual message: ${error.message}`);
    res.status(500).json({ message: 'Failed to send message.', error: error.message });
  }
};

/**
 * Send a mass text message.
 */
export const sendMassMessage = async (req: Request, res: Response) => {
  const { recipients, message } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ message: 'Recipients must be a non-empty array of phone numbers.' });
    return;
  }

  if (!message) {
    res.status(400).json({ message: 'Message is required.' });
    return;
  }

  try {
    for(const to of recipients) {
      await twilioService.testMessage(message, to, '+15017122661');
    }
    res.status(200).json({ message: 'Messages sent successfully.' });
  } catch (error: any) {
    logger.error(`Error sending mass messages: ${error.message}`);
    res.status(500).json({ message: 'Failed to send messages.', error: error.message });
  }
};