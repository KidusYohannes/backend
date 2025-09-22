import { Router } from 'express';
import { testMessage } from '../services/twilio.service';

const router = Router();

router.post('/test-sms', async (req, res) => {
  await testMessage();
  res.sendStatus(200);
});

export default router;
