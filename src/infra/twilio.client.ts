import twilio, { Twilio } from "twilio";

const {
  TWILIO_ACCOUNT_SID = "",
  TWILIO_AUTH_TOKEN = "",
  TWILIO_MESSAGING_SERVICE_SID = "",
  TWILIO_PHONE_NUMBER = "",
} = process.env;

let client: Twilio | null = null;


export function getTwilioClient(): Twilio {
  if (!client) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials missing (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN).");
    }
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return client!;
}


export function getMessagingFromConfig():
  | { messagingServiceSid: string }
  | { from: string } {
  if (TWILIO_MESSAGING_SERVICE_SID) {
    return { messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID };
  }
  if (!TWILIO_PHONE_NUMBER) {
    throw new Error(
      "Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER in env."
    );
  }
  return { from: TWILIO_PHONE_NUMBER };
}