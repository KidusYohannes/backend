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
  page: number = 1,
  perPage: number = 10,
  search: string = ''
): Promise<{ data: any; total: number; page: number; perPage: number }> => {
  const where: any = {};
  if (search) {
    where.name = { [Op.iLike]: `%${search}%` };
  }

  const offset = (page - 1) * perPage;

  const { rows, count } = await Events.findAndCountAll({
    where,
    offset,
    limit: perPage,
    order: [
      [sequelize.literal(`(
        SELECT CASE
          WHEN status = 'yes' THEN 1
          WHEN status = 'maybe' THEN 2
          WHEN status = 'no' THEN 3
          ELSE 4
        END
        FROM events_rsvps
        WHERE events_rsvps.event_id = events.id AND events_rsvps.user_id = '${sequelize.escape(userId)}'
      )`), 'ASC'],
      ['start_time', 'ASC']
    ],
    include: [
      {
        model: EventsRsvp,
        as: 'rsvps',
        where: { user_id: userId },
        required: false,
        attributes: ['status']
      }
    ]
  });

  const mahberIds = Array.from(new Set(rows.map(event => event.mahber_id)));
  const mahbers = await Mahber.findAll({ where: { id: { [Op.in]: mahberIds } } });
  const mahberMap = new Map(mahbers.map(mahber => [mahber.id, mahber.name]));

  const data = rows.map(event => {
    const eventObj = event.toJSON() as Events & { rsvps?: { status: string }[] };
    return {
      ...eventObj,
      rsvp_status: eventObj.rsvps?.[0]?.status || 'none',
      mahber_name: mahberMap.get(eventObj.mahber_id) || null
    };
  });

  return {
    data,
    total: count,
    page,
    perPage
  };
};
