// create a route for all events exported functions from events controller
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as eventsController from '../controllers/events.controller';

const router = Router();

// Event routes
router.post('/', authenticateToken, eventsController.createEvent);
router.get('/:id', eventsController.getEventById);
router.get('/', eventsController.getAllEvents);
router.get('/authenticated', eventsController.getAllEventsForUser);
router.put('/:id', authenticateToken, eventsController.updateEvent);
router.delete('/:id', authenticateToken, eventsController.deleteEvent);

// RSVP routes
router.post('/:eventId/rsvp', eventsController.createRsvp);
router.get('/:eventId/rsvps', eventsController.getEventRsvps);
router.put('/rsvps/:id', eventsController.updateRsvp);
router.delete('/rsvps/:id', eventsController.deleteRsvp);

export default router;