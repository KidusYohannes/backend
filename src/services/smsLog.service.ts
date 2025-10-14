// Make sure the path is correct and the file exists
import { SmsLog } from '../models/smsLog.model';
// If the file does not exist, create it as shown below
import logger from '../utils/logger';

export const createSmsLog = async ({
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
}) => {
  try {
    const smsLog = await SmsLog.create({
      type,
      senderId,
      recipients: recipients.join(','),
      message,
      mahberId,
      eventId: eventId !== null && eventId !== undefined ? Number(eventId) : null,
      status,
      timestamp: new Date()
    });
    logger.info(`Created SMS log with ID: ${smsLog.id}`);
    return smsLog;
  } catch (error: any) {
    logger.error(`Failed to create SMS log: ${error.message}`);
    throw error;
  }
};

export const updateSmsLogStatus = async (smsLogId: number, status: string) => {
  try {
    const [updatedRows] = await SmsLog.update(
      { status },
      { where: { id: smsLogId } }
    );
    if (updatedRows === 0) {
      logger.warn(`No SMS log found with ID: ${smsLogId}`);
      return null;
    }
    logger.info(`Updated SMS log ID ${smsLogId} with status: ${status}`);
    return updatedRows;
  } catch (error: any) {
    logger.error(`Failed to update SMS log status: ${error.message}`);
    throw error;
  }
};

export const getSmsLogs = async (filters: { senderId?: number; type?: string; status?: string }) => {
  try {
    const smsLogs = await SmsLog.findAll({ where: filters });
    logger.info(`Fetched ${smsLogs.length} SMS logs.`);
    return smsLogs;
  } catch (error: any) {
    logger.error(`Failed to fetch SMS logs: ${error.message}`);
    throw error;
  }
};