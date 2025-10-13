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
dotenv.config();
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://yenetech.com';

export const sendMessageForMember = async (req: AuthenticatedRequest, res: Response) => {
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
}

export const sendMassMessageForMembers = async (req: AuthenticatedRequest, res: Response) => {
  const { mahberId, message } = req.body;
  if (!mahberId || !message) {
    res.status(400).json({ message: 'Mahber ID and message are required.' });
    return;
  }
    try {
        // Fetch members' phone numbers based on mahberId
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
}


export const sendMassMessageForEventRsvps = async (req: AuthenticatedRequest, res: Response) => {
  const { eventId, message, status = 'yes' } = req.body;
  if (!eventId || !message) {
    res.status(400).json({ message: 'Event ID and message are required.' });
    return;
  }
    try {
        // Fetch RSVPed users' phone numbers based on eventId
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
    
        for (const to of rsvpsPhoneNumbers) {
        }
        res.status(200).json({ message: 'Messages sent successfully.' });
    } catch (error: any) {
        logger.error(`Error sending mass messages: ${error.message}`);
        res.status(500).json({ message: 'Failed to send messages.', error: error.message });
    }
}

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
}

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