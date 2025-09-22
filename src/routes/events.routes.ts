// create a route for all events exported functions from events controller
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { createEvent, createRsvp, getAllEvents, getAllEventsForUser, getEventById, getEventRsvps, updateEvent, updateRsvp, deleteEvent,deleteRsvp} from '../controllers/events.controller';

const router = Router();

// Event routes
router.post('/', authenticateToken, createEvent);
router.get('/', getAllEvents);
//add a log before redirecting to controller in the routes
router.get('/authenticated', authenticateToken, getAllEventsForUser);

router.put('/rsvps/:id', updateRsvp);
router.delete('/rsvps/:id', deleteRsvp);

router.get('/:id', getEventById);
router.put('/:id', authenticateToken, updateEvent);
router.delete('/:id', authenticateToken, deleteEvent);

// RSVP routes
router.post('/:eventId/rsvp', authenticateToken, createRsvp);
router.get('/:eventId/rsvps', authenticateToken, getEventRsvps);

export default router;