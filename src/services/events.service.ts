import Events from '../models/events.model';
import { Op } from 'sequelize';
import EventsCreationAttributes from '../models/events.model';

export const createEvent = async (eventData: EventsCreationAttributes): Promise<Events> => {
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
): Promise<{ data: Events[]; total: number; page: number; perPage: number }> => {
  const where: any = {};
  if (search) {
    where.name = { [Op.iLike]: `%${search}%` };
  }

  const offset = (page - 1) * perPage;
  const { rows, count } = await Events.findAndCountAll({
    where,
    offset,
    limit: perPage,
    order: [['id', 'DESC']]
  });

  return {
    data: rows.map(event => event.toJSON() as Events),
    total: count,
    page,
    perPage
  };
};

export const updateEvent = async (id: number, updatedData: Partial<EventsCreationAttributes>): Promise<Events | undefined> => {
  const event = await Events.findByPk(id);
  if (!event) return undefined;

  await event.update(updatedData);
  return event.toJSON() as Events;
};

export const deleteEvent = async (id: number): Promise<boolean> => {
  const deleted = await Events.destroy({ where: { id } });
  return deleted > 0;
};
