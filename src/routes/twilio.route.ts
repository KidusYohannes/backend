// add all the routings for twilio controller here
import express from 'express';
import * as twilioController from '../controllers/twilio.controller';   
const router = express.Router();
// POST /api/twilio/individual
router.post('/individual', twilioController.sendIndividualMessage);
// POST /api/twilio/mass
router.post('/mass', twilioController.sendMassMessage);
export default router;