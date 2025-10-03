import twilio from 'twilio';
import logger from '../utils/logger';
import { getTwilioClient, getMessagingFromConfig } from "../infra/twilio.client";
import RestException from 'twilio/lib/base/RestException';
import dotenv from 'dotenv';
dotenv.config();


const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);


export type SendResult =
  | { ok: true; to: string; sid: string }
  | { ok: false; to: string; error: string; code?: number };



export interface SendIndividualOptions {
  to: string;
  message: string;
  userId?: string; // for eligibility/quota checks
  statusCallbackUrl?: string; // e.g. `${API_BASE}/webhooks/twilio/status`
  forceBypassChecks?: boolean; // for admins/tests
}



export async function sendIndividualText({
  to,
  message,
  userId,
  statusCallbackUrl,
  forceBypassChecks = false,
}: SendIndividualOptions): Promise<SendResult> {
  try {
    // const e164 = toE164(to);

    // if (userId && !forceBypassChecks) {
    //   const eligible = await canSendSms(userId);
    //   if (!eligible.ok) {
    //     return { ok: false, to: e164, error: eligible.reason ?? "Not eligible" };
    //   }
    // }

    const client = getTwilioClient();
    const fromConfig = getMessagingFromConfig();

    const msg = await client.messages.create({
      body: message,
      to: to,
      statusCallback: statusCallbackUrl,
      ...fromConfig,
    });

    logger.info(`SMS sent to ${to} sid=${msg.sid}`);
    // TODO: insert into sms_logs(user_id, to, sid, body, status) for quotas & auditing
    return { ok: true, to: to, sid: msg.sid };
  } catch (err: any) {
    const e = err as RestException;
    logger.error(`Failed SMS to ${to}: ${e.message} (code=${e.code})`);
    return { ok: false, to, error: e.message ?? "Unknown error", code: e.code };
  }
}


export interface SendBulkOptions {
  recipients: Array<{ to: string; userId?: string }>;
  message: string;
  statusCallbackUrl?: string;
  // Throughput control
  batchSize?: number; // e.g. 10
  pauseMsBetweenBatches?: number; // e.g. 500
  forceBypassChecks?: boolean;
}


export async function sendMassText({
  recipients,
  message,
  statusCallbackUrl,
  batchSize = 25,
  pauseMsBetweenBatches = 0,
  forceBypassChecks = false,
}: SendBulkOptions): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    const slice = recipients.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      slice.map(({ to, userId }) =>
        sendIndividualText({
          to,
          message,
          userId,
          statusCallbackUrl,
          forceBypassChecks,
        })
      )
    );
    for (const r of settled) {
      results.push(r.status === "fulfilled" ? r.value : { ok: false, to: "unknown", error: (r.reason?.message ?? String(r.reason)) });
    }
    if (pauseMsBetweenBatches && i + batchSize < recipients.length) {
      await new Promise((res) => setTimeout(res, pauseMsBetweenBatches));
    }
  }
  return results;
}

async function createMessage(message: string, to: string, from: string) {
  const msg = await client.messages.create({
    body: message,
    from,
    to,
  });
    // from: "+15017122661",
    // to: "+15558675310",
  console.log(msg.body);
}

export const testMessage = async (message: string, to: string, from: string) => {
  try {
    createMessage(message, to, from);
  } catch (error) {
    console.error("Error sending message:", error);
  }
};
// const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
// const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
// const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

// if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
//   throw new Error('Twilio credentials are not properly configured in the environment variables.');
// }

// const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Send an individual text message.
 * @param to - The recipient's phone number.
 * @param message - The message to send.
 */
// export const sendIndividualText = async (to: string, message: string): Promise<void> => {
//   try {
//     const response = await client.messages.create({
//       body: message,
//       from: TWILIO_PHONE_NUMBER,
//       to
//     });
//     logger.info(`Text message sent to ${to}: ${response.sid}`);
//   } catch (error: any) {
//     logger.error(`Failed to send text message to ${to}: ${error.message}`);
//     throw new Error(`Failed to send text message: ${error.message}`);
//   }
// };

/**
 * Send a mass text message to multiple recipients.
 * @param recipients - An array of recipient phone numbers.
 * @param message - The message to send.
 */
// export const sendMassText = async (recipients: string[], message: string): Promise<void> => {
//   try {
//     const promises = recipients.map(to =>
//       client.messages.create({
//         body: message,
//         from: TWILIO_PHONE_NUMBER,
//         to
//       })
//     );
//     const responses = await Promise.all(promises);
//     responses.forEach((response) => {
//       logger.info(`Text message sent to ${response.to}: ${response.sid}`);
//     });
//   } catch (error: any) {
//     logger.error(`Failed to send mass text messages: ${error.message}`);
//     throw new Error(`Failed to send mass text messages: ${error.message}`);
//   }
// };
