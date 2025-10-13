import Events from '../models/events.model';
import { Op } from 'sequelize';
import EventsCreationAttributes from '../models/events.model';
import { Mahber } from '../models/mahber.model';
import * as util from '../utils/utils'
import EventsRsvp from '../models/events.rsvp.model';
import sequelize from '../config/db';
import logger from '../utils/logger';
import { Sequelize } from 'sequelize';

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

  if (!event) return undefined;
  // before rerturnning i want event rsvp counts like "event_rsvp": { "yes": 0,"no": 0,"maybe": 1}

  const eventId = event?.id ? Number(event.id) : null;

  if (eventId) {
    const rsvpCounts = await EventsRsvp.count({
      where: { event_id: String(eventId) },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        'status'
      ],
      group: ['status']
    });

    // Transform the rsvpCounts into the desired format
    const eventRsvp = (rsvpCounts as Array<{ status: 'yes' | 'no' | 'maybe'; count: number }>).reduce(
      (acc: { yes: number; no: number; maybe: number }, curr) => {
        acc[curr.status] = curr.count;
        return acc;
      },
      { yes: 0, no: 0, maybe: 0 }
    );

    return {
      ...event.toJSON(),
      event_rsvp: eventRsvp
    } as unknown as Events;
  }

  return event ? (event.toJSON() as Events) : undefined;
};

export const getAllEvents = async (
  page: number = 1,
  perPage: number = 10,
  search: string = ''
): Promise<{ data: any; total: number; page: number; perPage: number }> => {
  const where: any = { is_public: 'true' };
  if (search) {
    where.title = { [Op.iLike]: `%${search}%` };
  }

  logger.info(`Where clause for fetching events: ${JSON.stringify(where)}`);
  const offset = (page - 1) * perPage;
  const { data, total:count, page: currentPage, perPage: currentPerPage } = await getEventsWithRsvp(
    where,
    perPage,
    page
  )

  return {
    data,
    total: count,
    page: currentPage,
    perPage: currentPerPage
  };
};

export const updateEvent = async (id: number, updatedData: Partial<EventsCreationAttributes>): Promise<Events | undefined> => {
  const event = await Events.findByPk(id);
  if (!event) return undefined;
  // only mahber admins can create events
    const mahber = await Mahber.findByPk(event.mahber_id);
    logger.info(`Updating event ${id} for mahber ${event.mahber_id}, fetched mahber: ${JSON.stringify(mahber)}`);
    logger.info(`Event creator: ${event.created_by}`);
    if (
        !mahber ||
        !await util.isAdminOfMahber(
            String(updatedData.last_updated_by),
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

  // const { rows, count } = await Events.findAndCountAll({
  //   where,
  //   offset,
  //   limit: perPage,
  //   order: [['start_time', 'ASC']], // simple ordering, no CASE needed
  // });
  const { data, total: count, page: currentPage, perPage: currentPerPage } = await getEventsWithRsvpAuthenticated(
    where,
    perPage,
    page,
    Number(userId)
  )


  // get event rsvps for this user and the events, rows
  // const eventIds = rows.map(e => String(e.id));
  // const rsvps = eventIds.length
  //   ? await EventsRsvp.findAll({
  //       where: {
  //         event_id: { [Op.in]: eventIds },
  //         user_id: String(userId),
  //       },
  //       attributes: ['event_id', 'status'],
  //     })
  //   : [];
  // logger.info(`Fetched ${rsvps.length} RSVPs for user ${userId} and events ${eventIds.join(', ')} and rsvps are ${JSON.stringify(rsvps)}`);
  // const rsvpMap = new Map(rsvps.map(r => [Number(r.event_id), r.status]));
  // logger.info(`RSVP Map: ${JSON.stringify(Array.from(rsvpMap.entries()))}`);
  // Batch load mahber names
  // const mahberIds: number[] = Array.from(new Set(rows.map(e => Number(e.mahber_id)).filter((id): id is number => typeof id === 'number' && !isNaN(id))));
  // logger.info(`Mahber IDs to fetch: ${JSON.stringify(mahberIds)}`);
  // const mahbers = mahberIds.length
  //   ? await Mahber.findAll({ where: { id: { [Op.in]: mahberIds } } })
  //   : [];
  // logger.info(`Fetched mahbers: ${JSON.stringify(mahbers)}`);
  // const mahberMap = new Map(mahbers.map(m => {
  //   console.log('Mahber:', m.id, m.name);
  //   return [m.id, m.name];
  // }));

  // logger.info(`Mahber map: ${JSON.stringify(mahberMap)}`);
  // const data = rows.map(ev => {
  //   // get rsvp status if any
  //   const rsvp = rsvpMap.get(ev.id);
  //   const rsvp_status = rsvp ? rsvp : 'none';
  //   const json = ev.toJSON() as Events;
  //   // if you don’t want to expose the rsvps array, strip it:
  //   const { rsvps, ...rest } = json as any;
  //   return {
  //     ...rest,
  //     rsvp_status
  //   };
  // });

  return { data, total: count, page: currentPage, perPage: currentPerPage };
};

export const getAllMahberEvents = async (
  mahber_id: any,
  page = 1,
  perPage = 10,
  specificSearch = ''
) => {

  const validColumns = [
    'title', 'description', 'location', 'start_time', 'end_time', 'rsvp_deadline'
  ];
  const where: any = {mahber_id: String(mahber_id)};
  if (specificSearch && typeof specificSearch === 'object') {
    for (const [key, value] of Object.entries(specificSearch)) {
      const column = key;
      if (validColumns.includes(column) && typeof value === 'string') {
        where[column] = { [Op.iLike]: `%${value}%` };
      } else if (!validColumns.includes(column)) {
        throw new Error(`Invalid column name in specificSearch: ${column}`);
      }
    }
  }
  logger.info(`Where clause for fetching mahber events: ${JSON.stringify(where)}`);
  const offset = (page - 1) * perPage;

  const { data: eventsData, total, page: currentPage, perPage: currentPerPage } = await getEventsWithRsvp(
    where,
    perPage,
    page
  )
  logger.info(`Fetched ${eventsData.length} events out of ${total} total events for mahber_id ${mahber_id}.`);
  logger.info(`Fetched ${eventsData} events out of ${total} total events for mahber_id ${mahber_id}.`);

  // Batch load mahber names
  const resolvedEventsData = await Promise.all(eventsData);
  logger.info(`Resolved events data: ${JSON.stringify(resolvedEventsData)}`);
  const mahberIds = Array.from(
    new Set(
      resolvedEventsData
        .filter(e => 'mahber_id' in e && e.mahber_id !== undefined)
        .map(e => Number((e as { mahber_id: string | number }).mahber_id))
        .filter(Boolean)
    )
  );
  logger.info(`Mahber IDs to fetch: ${JSON.stringify(mahberIds)}`);
  const mahbers = mahberIds.length
    ? await Mahber.findAll({ where: { id: { [Op.in]: mahberIds } } })
    : [];
  const mahberMap = new Map(mahbers.map(m => [m.id, m.name]));

  logger.info(`Mahber map: ${JSON.stringify(mahberMap)}`);

  const data = resolvedEventsData.map(ev => ({
    ...ev,
    mahber_name: 'mahber_id' in ev && ev.mahber_id !== undefined
      ? mahberMap.get(Number(ev.mahber_id)) ?? null
      : null,
  }));

  return { data, total, page: currentPage, perPage: currentPerPage };
};


/**
 * get events with rsvp status counts for every event inside the response json like 
 * event_rsvp: {yes: 10, no: 5, maybe: 90}
 * @param where 
 * @param perPage 
 * @param page 
 * 
 * @returns json
 */
async function getEventsWithRsvp(
  where: any,
  perPage = 10,
  page = 1
) {
  try {
    logger.info(`Entering getEventsWithRsvp function`);
    logger.info(`Where clause for fetching events with RSVP: ${JSON.stringify(where)}`);
    const offset = (page - 1) * perPage;

    // Ensure mahber_id is cast to a number if it exists in the where clause
    if (where.mahber_id) {
      logger.info(`Casting mahber_id to number: ${where.mahber_id}`);
      where.mahber_id = String(where.mahber_id);
    }

    const { rows, count } = await Events.findAndCountAll({
      where,
      offset,
      limit: perPage,
      order: [['id', 'DESC']], // simple ordering, no CASE needed
    });

    logger.info(`Fetched ${rows.length} events out of ${count} total events.`);

    // Use Promise.all to resolve all asynchronous operations in the data array
    const data = await Promise.all(
      rows.map(async ev => {
        // Log the event object to debug its structure
        logger.info(`Processing event object: ${JSON.stringify(ev)}`);

        // Ensure event_id is valid
        const eventId = ev.id ? Number(ev.id) : null;
        if (!eventId) {
          logger.error(`Invalid event ID for event object: ${JSON.stringify(ev)}`);
          return {
            error: 'Invalid event ID'
          };
        }

        try {
          const whereClause = { event_id: String(eventId) };
          const eventRsvp = await EventsRsvp.findAll({
            attributes: [
              'status',
              [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
            ],
            where: whereClause,
            group: ['status']
          });

          // Aggregate RSVP counts into a single object
          const rsvpCounts = { yes: 0, no: 0, maybe: 0 };
          eventRsvp.forEach(rsvp => {
            const status = rsvp.status;
            const count = Number(rsvp.get('count'));
            if (status in rsvpCounts) {
              rsvpCounts[status] = count;
            }
          });

          // Ensure ev is properly transformed
          const eventData = ev.toJSON ? ev.toJSON() : ev;
          const _return = {
            ...eventData,
            event_rsvp: rsvpCounts
          };
          logger.info(`Returning event data with RSVP: ${JSON.stringify(_return)}`);
          return _return;
        } catch (error) {
          const errorMessage = (error instanceof Error) ? error.message : String(error);
          logger.error(`Error fetching RSVPs for event ID ${eventId}: ${errorMessage}`);
          throw error;
        }
      })
    );

    logger.info(`Resolved events data: ${JSON.stringify(data)}`);
    return { data, total: count, page, perPage };
  } catch (error) {
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    logger.error(`Error in getEventsWithRsvp: ${errorMessage}`);
    throw error;
  }
}

/**
 * get events with rsvp status counts for every event inside the response json like 
 * event_rsvp: {yes: 10, no: 5, maybe: 90}
 * @param where 
 * @param perPage 
 * @param page 
 * 
 * @returns json
 */
async function getEventsWithRsvpAuthenticated(
  where: any,
  perPage = 10,
  page = 1,
  userId: number
) {
  try {
    logger.info(`Entering getEventsWithRsvpAuthenticated function`);
    logger.info(`Where clause for fetching events with RSVP: ${JSON.stringify(where)}`);
    const offset = (page - 1) * perPage;

    // Ensure mahber_id is cast to a number if it exists in the where clause
    if (where.mahber_id) {
      logger.info(`Casting mahber_id to number: ${where.mahber_id}`);
      where.mahber_id = String(where.mahber_id);
    }

    const { rows, count } = await Events.findAndCountAll({
      where,
      offset,
      limit: perPage,
      order: [['id', 'DESC']], // simple ordering, no CASE needed
    });

    logger.info(`Fetched ${rows.length} events out of ${count} total events.`);

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

    const rsvpMap = new Map(rsvps.map(r => [Number(r.event_id), r.status]));

    // Use Promise.all to resolve all asynchronous operations in the data array
    const data = await Promise.all(
      rows.map(async ev => {
        // Ensure event_id is valid
        const eventId = ev.id ? Number(ev.id) : null;
        logger.info(`Processing event with ID: ${eventId}`);

        if (!eventId) {
          logger.error(`Invalid event ID for event object: ${JSON.stringify(ev)}`);
          return {
            ...ev,
            event_rsvp: {},
            error: 'Invalid event ID'
          };
        }

        const rsvp = rsvpMap.get(ev.id);
        const rsvp_status = rsvp ? rsvp : 'none';

        logger.info(`RSVP status for event ID ${eventId} and user ID ${userId}: ${rsvp_status}`);

        try {
          // Log the eventId before constructing the whereClause
          logger.info(`Constructing whereClause for event ID: ${eventId}`);
          const whereClause = { event_id: String(eventId) }; // Simplified whereClause
          logger.info(`Constructed whereClause: ${JSON.stringify(whereClause)}`);

          const eventRsvp = await EventsRsvp.findAll({
            attributes: [
              'status',
              [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
            ],
            where: whereClause,
            group: ['status']
          });

          logger.info(`Fetched ${eventRsvp.length} RSVP records for event ID ${eventId}.`);

          // Aggregate RSVP counts into a single object
          const rsvpCounts = { yes: 0, no: 0, maybe: 0 };
          eventRsvp.forEach(rsvp => {
            const status = rsvp.status;
            const count = Number(rsvp.get('count'));
            if (status in rsvpCounts) {
              rsvpCounts[status] = count;
            }
          });

          const _return = {
            ...ev.toJSON(),
            event_rsvp: rsvpCounts,
            rsvp_status
          };
          logger.info(`Returning event data with RSVP: ${JSON.stringify(_return)}`);
          return _return;
        } catch (error) {
          const errorMessage = (error instanceof Error) ? error.message : String(error);
          logger.error(`Error fetching RSVPs for event ID ${eventId}: ${errorMessage}`);
          throw error;
        }
      })
    );

    logger.info(`Resolved events data: ${JSON.stringify(data)}`);
    return { data, total: count, page, perPage };
  } catch (error) {
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    logger.error(`Error in getEventsWithRsvpAuthenticated: ${errorMessage}`);
    throw error;
  }
}