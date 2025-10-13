// src/routes/webhooks/twilio.ts
import express, { Request, Response } from "express";
import logger from "../utils/logger";
// If you want signature validation:
// import twilio from "twilio"; // then twilio.validateRequest(...)
const router = express.Router();

/**
 * Twilio sends form-encoded webhooks.
 * Ensure you have app.use(express.urlencoded({ extended: false })) in your app setup.
 */
router.post("/sms/status", async (req: Request, res: Response) => {
  try {
    const {
      MessageSid,
      MessageStatus, // queued|sent|delivered|undelivered|failed
      To,
      From,
      ErrorCode,
      ErrorMessage,
    } = req.body as Record<string, string>;

    // TODO: persist to sms_logs: sid, status, to, from, error_code, error_message
    logger.info(
      `Twilio status sid=${MessageSid} status=${MessageStatus} to=${To} from=${From} err=${ErrorCode ?? ""} ${ErrorMessage ?? ""}`
    );

    // If delivered/failed -> update counters, retry logic, etc.
    // Note: Avoid auto-retrying undelivered/failed without inspecting codes to prevent loops.

    res.status(204).end();
  } catch (e: any) {
    logger.error(`Twilio webhook error: ${e.message}`);
    res.status(200).end(); // Twilio expects 200s; don't cause repeated retries.
  }
});

export default router;
