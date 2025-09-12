import twilio from 'twilio';
import logger from '../utils/logger';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  throw new Error('Twilio credentials are not properly configured in the environment variables.');
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Send an individual text message.
 * @param to - The recipient's phone number.
 * @param message - The message to send.
 */
export const sendIndividualText = async (to: string, message: string): Promise<void> => {
  try {
    const response = await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to
    });
    logger.info(`Text message sent to ${to}: ${response.sid}`);
  } catch (error: any) {
    logger.error(`Failed to send text message to ${to}: ${error.message}`);
    throw new Error(`Failed to send text message: ${error.message}`);
  }
};

/**
 * Send a mass text message to multiple recipients.
 * @param recipients - An array of recipient phone numbers.
 * @param message - The message to send.
 */
export const sendMassText = async (recipients: string[], message: string): Promise<void> => {
  try {
    const promises = recipients.map(to =>
      client.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to
      })
    );
    const responses = await Promise.all(promises);
    responses.forEach((response) => {
      logger.info(`Text message sent to ${response.to}: ${response.sid}`);
    });
  } catch (error: any) {
    logger.error(`Failed to send mass text messages: ${error.message}`);
    throw new Error(`Failed to send mass text messages: ${error.message}`);
  }
};
