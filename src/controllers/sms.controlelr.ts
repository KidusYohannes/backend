// create a controller for sending sms
import { Request, Response } from 'express';
import * as twilioService from '../services/twilio.service';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Member } from '../models/member.model';
import { User } from '../models/user.model';
import dotenv from 'dotenv';
import FrontlineApi from 'twilio/lib/rest/FrontlineApi';
import EventsRsvp from '../models/events.rsvp.model';
import { SmsLog } from '../models/smsLog.model';
dotenv.config();
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://yenetech.com';

export const logSms = async ({
  type,
  senderId,
  recipients,
  message,
  mahberId = null,
  eventId = null
}: {
  type: string;
  senderId: number;
  recipients: string[];
  message: string;
  mahberId?: string | null;
  eventId?: string | null;
}) => {
  try {
    await SmsLog.create({
      type,
      senderId,
      recipients: recipients.join(','),
      message,
      mahberId: typeof mahberId === 'string' ? parseInt(mahberId) : mahberId,
      eventId: typeof eventId === 'string' ? parseInt(eventId) : eventId,
      timestamp: new Date()
    });
    logger.info(`Logged SMS of type '${type}' for ${recipients.length} recipients.`);
  } catch (error: any) {
    logger.error(`Failed to log SMS: ${error.message}`);
  }
};

export const sendMessageForMember = async (req: AuthenticatedRequest, res: Response) => {
  const { to, message } = req.body;

  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized: user not found in request' });
    return;
  }

  if (!to || !message) {
    res.status(400).json({ message: 'Recipient phone number and message are required.' });
    return;
  }

  try {
    await twilioService.testMessage(message, to, '+15017122661');
    await logSmsToDb({
      type: 'individual',
      senderId: req.user.id,
      recipients: [to],
      message
    });
    res.status(200).json({ message: 'Message sent successfully.' });
  } catch (error: any) {
    logger.error(`Error sending individual message: ${error.message}`);
    res.status(500).json({ message: 'Failed to send message.', error: error.message });
  }
};

export const sendMassMessageForMembers = async (req: AuthenticatedRequest, res: Response) => {
  const { mahberId, message } = req.body;
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized: user not found in request' });
    return;
  }
  if (!mahberId || !message) {
    res.status(400).json({ message: 'Mahber ID and message are required.' });
    return;
  }
  try {
    const membersPhoneNumbers = await getMembersPhoneNumbers(mahberId);
    if (membersPhoneNumbers.length === 0) {
      res.status(404).json({ message: 'No members found for the specified Mahber.' });
      return;
    }
    await twilioService.sendMassText({
      recipients: membersPhoneNumbers.map(phone => ({ to: phone })),
      message,
      statusCallbackUrl: FRONTEND_URL + '/webhook/sms/status'
    });
    await logSmsToDb({
      type: 'mass',
      senderId: req.user.id,
      recipients: membersPhoneNumbers,
      message,
      mahberId: typeof mahberId === 'string' ? parseInt(mahberId) : mahberId
    });
    res.status(200).json({ message: 'Messages sent successfully.' });
  } catch (error: any) {
    logger.error(`Error sending mass messages: ${error.message}`);
    res.status(500).json({ message: 'Failed to send messages.', error: error.message });
  }
};

export const sendMassMessageForEventRsvps = async (req: AuthenticatedRequest, res: Response) => {
  const { eventId, message, status = 'yes' } = req.body;
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized: user not found in request' });
    return;
  }
  if (!eventId || !message) {
    res.status(400).json({ message: 'Event ID and message are required.' });
    return;
  }
  try {
    const rsvpsPhoneNumbers = await getEventRsvpsPhoneNumbers(eventId, status);
    if (rsvpsPhoneNumbers.length === 0) {
      res.status(404).json({ message: 'No RSVPed users found for the specified event.' });
      return;
    }
    await twilioService.sendMassText({
      recipients: rsvpsPhoneNumbers.map(phone => ({ to: phone })),
      message,
      statusCallbackUrl: FRONTEND_URL + '/webhook/sms/status'
    });
    await logSmsToDb({
      type: 'event',
      senderId: req.user.id,
      recipients: rsvpsPhoneNumbers,
      message,
      eventId
    });
    res.status(200).json({ message: 'Messages sent successfully.' });
  } catch (error: any) {
    logger.error(`Error sending mass messages: ${error.message}`);
    res.status(500).json({ message: 'Failed to send messages.', error: error.message });
  }
};

export const sendContributionMessage = async (req: AuthenticatedRequest, res: Response) => {
  const {
    mahberId,
    message = 'A new contribution details have been posted. Please check your Mahber app for more information.'
  } = req.body;

  if (!mahberId || !message) {
    res.status(400).json({ message: 'Mahber ID and message are required.' });
    return;
  }

  try {
    const membersPhoneNumbers = await getMembersPhoneNumbers(mahberId);
    if (membersPhoneNumbers.length === 0) {
      res.status(404).json({ message: 'No members found for the specified Mahber.' });
      return;
    }

    await twilioService.sendMassText({
      recipients: membersPhoneNumbers.map(phone => ({ to: phone })),
      message,
      statusCallbackUrl: FRONTEND_URL + '/webhook/sms/status'
    });

    for (const to of membersPhoneNumbers) {
    }
    res.status(200).json({ message: 'Messages sent successfully.' });
  } catch (error: any) {
    logger.error(`Error sending mass messages: ${error.message}`);
    res.status(500).json({ message: 'Failed to send messages.', error: error.message });
  }
};

async function getMembersPhoneNumbers(mahberId: string): Promise<string[]> {
  // Implement logic to fetch members' phone numbers from the database based on mahberId
  const membersIds = await Member.findAll({
    where: { edir_id: mahberId, status: 'accepted' },
    attributes: ['id']
  });
  const users = await User.findAll({
    where: { id: membersIds.map(member => member.member_id) }
  });
  const phoneNumbers = users.map(user => user.phone).filter(phone => phone);
  return phoneNumbers;
}

async function getEventRsvpsPhoneNumbers(eventId: string, status: string): Promise<string[]> {
  // Implement logic to fetch RSVPed users' phone numbers from the database based on eventId
  const rsvps = await EventsRsvp.findAll({
    where: { event_id: eventId, status },
    attributes: ['id']
  });
  const users = await User.findAll({
    where: { id: rsvps.map(rsvp => rsvp.user_id) }
  });
  const phoneNumbers = users.map(user => user.phone).filter(phone => phone);
  return phoneNumbers;
}

async function logSmsToDb({
  type,
  senderId,
  recipients,
  message,
  mahberId = null,
  eventId = null,
  status = 'sent'
}: {
  type: string;
  senderId: number;
  recipients: string[];
  message: string;
  mahberId?: number | null;
  eventId?: string | null;
  status?: string;
}): Promise<SmsLog[]> {
  try {
    const logs = [];
    for (const recipient of recipients) {
      const smsLog = await SmsLog.create({
        type,
        senderId,
        recipients: recipient,
        message,
        mahberId,
        eventId: eventId !== null && eventId !== undefined ? Number(eventId) : null,
        status,
        timestamp: new Date()
      });
      logger.info(`Created SMS log with ID: ${smsLog.id}`);
      logs.push(smsLog);
    }
    return logs;
  } catch (error: any) {
    logger.error(`Failed to create SMS log: ${error.message}`);
    throw error;
  }
}
