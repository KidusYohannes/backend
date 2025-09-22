import Events from '../models/events.model';
import { Op } from 'sequelize';
import EventsCreationAttributes from '../models/events.model';
import { Mahber } from '../models/mahber.model';
import * as util from '../utils/utils'
import EventsRsvp from '../models/events.rsvp.model';
import sequelize from '../config/db';
import logger from '../utils/logger';

export const createEvent = async (eventData: EventsCreationAttributes): Promise<Events> => {
    // only mahber admins can create events
    const mahber = await Mahber.findByPk(eventData.mahber_id);
    if (
        !mahber ||
        !await util.isAdminOfMahber(
            String(eventData.created_by),
            String(mahber.id)
        )
    ) {
        throw new Error('Only Mahber admins can create events');
    }
    const event = await Events.create(eventData);
    return event.toJSON() as Events;
};

export const getEventById = async (id: number): Promise<Events | undefined> => {
  const event = await Events.findByPk(id);
  return event ? (event.toJSON() as Events) : undefined;
};

export const getAllEvents = async (
  page: number = 1,
  perPage: number = 10,
  search: string = ''
): Promise<{ data: any; total: number; page: number; perPage: number }> => {
  const where: any = { is_public: 'true' };
  if (search) {
    where.name = { [Op.iLike]: `%${search}%` };
  }

  logger.info(`Where clause for fetching events: ${JSON.stringify(where)}`);
  const offset = (page - 1) * perPage;
  const { rows, count } = await Events.findAndCountAll({
    where,
    offset,
    limit: perPage,
    order: [['id', 'DESC']]
  });

  logger.info(`Fetched ${rows} events out of ${count} total events.`);

  const mahberIds = Array.from(new Set(rows.map(event => event.mahber_id)));
  const mahbers = await Mahber.findAll({ where: { id: { [Op.in]: mahberIds } } });
  const mahberMap = new Map(mahbers.map(mahber => [mahber.id, mahber.name]));

  const data = rows.map(event => ({
    ...event.toJSON(),
    mahber_name: mahberMap.get(event.mahber_id) || null
  }));

  return {
    data,
    total: count,
    page,
    perPage
  };
};

export const updateEvent = async (id: number, updatedData: Partial<EventsCreationAttributes>): Promise<Events | undefined> => {
  const event = await Events.findByPk(id);
  if (!event) return undefined;
  // only mahber admins can create events
    const mahber = await Mahber.findByPk(updatedData.mahber_id);
    if (
        !mahber ||
        !await util.isAdminOfMahber(
            String(updatedData.created_by),
            String(mahber.id)
        )
    ) {
        throw new Error('Only Mahber admins can create events');
    }

  await event.update(updatedData);
  return event.toJSON() as Events;
};

export const deleteEvent = async (id: number): Promise<boolean> => {
  const deleted = await Events.destroy({ where: { id } });
  return deleted > 0;
};

// Get all events for authenticated user with rsvp status should not be filter but when available attach user rsvp
export const getAllEventsForUser = async (
  userId: number,
  page = 1,
  perPage = 10,
  search = ''
): Promise<{ data: any; total: number; page: number; perPage: number }> => {
  if (!Number.isFinite(userId)) throw new Error('Invalid user id');

  const where: any = {};
  if (search) where.name = { [Op.iLike]: `%${search}%` };

  const offset = (page - 1) * perPage;

  const { rows, count } = await Events.findAndCountAll({
    where,
    offset,
    limit: perPage,
    order: [['start_time', 'ASC']], // simple ordering, no CASE needed
  });


  // get event rsvps for this user and the events, rows
  const eventIds = rows.map(e => String(e.id));
  const rsvps = eventIds.length
    ? await EventsRsvp.findAll({
        where: {
          event_id: { [Op.in]: eventIds },
          user_id: String(userId),
        },
        attributes: ['event_id', 'status'],
      })
    : [];
  // logger.info(`Fetched ${rsvps.length} RSVPs for user ${userId} and events ${eventIds.join(', ')} and rsvps are ${JSON.stringify(rsvps)}`);
  const rsvpMap = new Map(rsvps.map(r => [Number(r.event_id), r.status]));
  // logger.info(`RSVP Map: ${JSON.stringify(Array.from(rsvpMap.entries()))}`);
  // Batch load mahber names
  const mahberIds = Array.from(new Set(rows.map(e => Number(e.mahber_id)).filter(Boolean)));
  // logger.info(`Mahber IDs to fetch: ${JSON.stringify(mahberIds)}`);
  const mahbers = mahberIds.length
    ? await Mahber.findAll({ where: { id: { [Op.in]: mahberIds } } })
    : [];
  // logger.info(`Fetched mahbers: ${JSON.stringify(mahbers)}`);
  const mahberMap = new Map(mahbers.map(m => {
    console.log('Mahber:', m.id, m.name);
    return [m.id, m.name];
  }));

  // logger.info(`Mahber map: ${JSON.stringify(mahberMap)}`);
  const data = rows.map(ev => {
    // get rsvp status if any
    const rsvp = rsvpMap.get(ev.id);
    const rsvp_status = rsvp ? rsvp : 'none';
    const json = ev.toJSON() as Events;
    // if you don’t want to expose the rsvps array, strip it:
    const { rsvps, ...rest } = json as any;
    return {
      ...rest,
      rsvp_status,
      mahber_name: mahberMap.get(Number(rest.mahber_id)) ?? null,
    };
  });

  return { data, total: count, page, perPage };
};
