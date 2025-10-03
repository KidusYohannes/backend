import { Router } from 'express';
import { testMessage } from '../services/twilio.service';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();

router.post('/test-sms', async (req, res) => {
  const { message, to } = req.body;
  await testMessage(message, '+18777804236', process.env.TWILIO_PHONE_NUMBER || '+18778132506');
  res.sendStatus(200);
});

export default router;
