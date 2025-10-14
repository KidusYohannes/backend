import { Request, Response } from 'express';
import * as eventsService from '../services/events.service';
import * as eventsRsvpService from '../services/eventsRsvp.service';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Create a new event.
 */
export const createEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // attach user id as created_by in the event body
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: user not found in request' });
      return;
    }
    req.body.created_by = req.user.id;
    const event = await eventsService.createEvent(req.body);
    res.status(201).json(event);
  } catch (err: any) {
    logger.error(`Error creating event: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

/**
 * Get an event by ID.
 */
export const getEventById = async (req: Request, res: Response) => {
  try {
    const event = await eventsService.getEventById(Number(req.params.id));
    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }
    res.json(event);
  } catch (err: any) {
    logger.error(`Error fetching event: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

/**
 * Get all events with optional search and pagination.
 */
export const getAllEvents = async (req: Request, res: Response) => {
  const { page = 1, perPage = 10, search = '' } = req.query;
  try {
    const events = await eventsService.getAllEvents(
      Number(page),
      Number(perPage),
      String(search)
    );
    res.json(events);
  } catch (err: any) {
    logger.error(`Error fetching events: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

/**
 * Get all events for authenticated user with rsvp status
 * @param req 
 * @param res 
 * @returns 
 */
export const getAllEventsForUser = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, perPage = 10, search = '' } = req.query;
  console.log('---- controller start ------')
  if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: user not found in request' });
      return;
  }
  logger.info(`Fetching events for user ${req.user.id} with search: ${search}, page: ${page}, perPage: ${perPage}`);
  const events = await eventsService.getAllEventsForUser(Number(req.user.id), Number(page), Number(perPage), String(search));
  res.json(events);
};


/**
 * Update an event by ID.
 */
export const updateEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // attach user id as last_updated_by in the request body
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: user not found in request' });
      return;
    }
    req.body.last_updated_by = req.user.id; 
    const event = await eventsService.updateEvent(Number(req.params.id), req.body);
    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }
    res.json(event);
  } catch (err: any) {
    logger.error(`Error updating event: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

/**
 * Delete an event by ID.
 */
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const deleted = await eventsService.deleteEvent(Number(req.params.id));
    if (!deleted) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }
    res.status(204).send();
  } catch (err: any) {
    logger.error(`Error deleting event: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

/**
 * RSVP to an event.
 */
export const createRsvp = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized: user not found in request' });
    return;
  }
  const eventId = req.params.eventId

  //check if the event exists
  const event = await eventsService.getEventById(Number(eventId));
  if (!event) {
    res.status(404).json({ message: 'Event not found' });
  }

  // check if the user has already RSVPed to the event
  const existingRsvp = await eventsRsvpService.getRsvpByUserAndEvent(Number(req.user.id), Number(eventId));
  
  // if rsvp exists update the existing rsvp
  if (existingRsvp) {
    try {
      const rsvp = await eventsRsvpService.updateRsvp(existingRsvp.id, req.body);
      if (!rsvp) {
        res.status(404).json({ message: 'RSVP not found' });
        return;
      }
      res.json(rsvp);
      return;
    } catch (err: any) { 
      logger.error(`Error updating existing RSVP: ${err.message}`);
      res.status(400).json({ message: err.message });
      return;
    }
  }

  const body = { ...req.body, user_id: String(req.user.id), event_id: String(eventId) };
  try {
    const rsvp = await eventsRsvpService.createRsvp(body);
    res.status(201).json(rsvp);
  } catch (err: any) {
    logger.error(`Error creating RSVP: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

/**
 * Get RSVPs for an event.
 */
export const getEventRsvps = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, perPage = 10 } = req.query;
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized: user not found in request' });
    return;
  }
  const userId = req.user.id;
  // check if the user is the creator of the event
  const event = await eventsService.getEventById(Number(req.params.eventId));
  if (!event) {
    res.status(404).json({ message: 'Event not found' });
    return;
  }
  if (Number(event.created_by) !== Number(userId)) {
    // logger.info(`User ${userId} is not the creator of event ${event.id} and event creator is ${event.created_by}`);
    res.status(403).json({ message: 'Forbidden: Only the event creator can view RSVPs.' });
    return;
  }
  try {
    const rsvps = await eventsRsvpService.getAllRsvps(
      Number(req.params.eventId),
      Number(page),
      Number(perPage)
    );
    res.json(rsvps);
  } catch (err: any) {
    logger.error(`Error fetching RSVPs: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

/**
 * Update an RSVP by ID.
 */
export const updateRsvp = async (req: Request, res: Response) => {
  try {
    const rsvp = await eventsRsvpService.updateRsvp(Number(req.params.id), req.body);
    if (!rsvp) {
      res.status(404).json({ message: 'RSVP not found' });
      return;
    }
    res.json(rsvp);
  } catch (err: any) {
    logger.error(`Error updating RSVP: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

/**
 * Delete an RSVP by ID.
 */
export const deleteRsvp = async (req: Request, res: Response) => {
  try {
    const deleted = await eventsRsvpService.deleteRsvp(Number(req.params.id));
    if (!deleted) {
      res.status(404).json({ message: 'RSVP not found' });
      return;
    }
    res.status(204).send();
  } catch (err: any) {
    logger.error(`Error deleting RSVP: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

/**
 * get all event for mahber in desc order
 */
export const getMahberEvents = async (req: Request, res: Response) => {
  const specificSearch = typeof req.query.specificSearch === 'string' ? JSON.parse(req.query.specificSearch) : {};
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 10;
  const mahber_id = req.query.mahber_id ? req.query.mahber_id as string : null;
  if(mahber_id && isNaN(Number(mahber_id))) {
    res.status(400).json({ message: 'Bad Request: mahber_id must be a number' });
    return;
  }
  try {
    const events = await eventsService.getAllMahberEvents(Number(mahber_id), Number(page), Number(perPage));
    res.json(events);
  } catch (err: any) {
    logger.error(`Error fetching mahber events: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};
