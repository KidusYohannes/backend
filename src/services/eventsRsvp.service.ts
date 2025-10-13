import EventsRsvp from '../models/events.rsvp.model';
import { Op } from 'sequelize';
import EventsRsvpCreationAttributes from '../models/events.rsvp.model';
import { User } from '../models/user.model';

export const createRsvp = async (rsvpData: Omit<EventsRsvpCreationAttributes, 'id'>): Promise<EventsRsvp> => {
  const rsvp = await EventsRsvp.create(rsvpData);
  return rsvp.toJSON() as EventsRsvp;
};

export const getRsvpById = async (id: number): Promise<EventsRsvp | undefined> => {
  const rsvp = await EventsRsvp.findByPk(id);
  return rsvp ? (rsvp.toJSON() as EventsRsvp) : undefined;
};

export const getAllRsvps = async (
  eventId: number,
  page: number = 1,
  perPage: number = 10
): Promise<{ data: EventsRsvp[]; total: number; page: number; perPage: number }> => {
  const offset = (page - 1) * perPage;
  const { rows, count } = await EventsRsvp.findAndCountAll({
    where: { event_id: String(eventId) },
    offset,
    limit: perPage,
    order: [['id', 'DESC']]
  });

  // map user name and email to each rsvp
  const userIds = rows.map(rsvp => rsvp.user_id);
  const users = await User.findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ['id', 'full_name', 'email']
  });
  const userMap = new Map(users.map(u => [String(u.id), u]));  

  return {
    data: rows.map(rsvp => {
      const user = userMap.get(String(rsvp.user_id));
      return {
        ...rsvp.toJSON(),
        user_name: user ? user.full_name : 'Unknown',
        user_email: user ? user.email : 'Unknown'
      } as unknown as EventsRsvp;
    }),
    total: count,
    page,
    perPage
  };
};

export const updateRsvp = async (id: number, updatedData: Partial<EventsRsvp>): Promise<EventsRsvp | undefined> => {
  const rsvp = await EventsRsvp.findByPk(id);
  if (!rsvp) return undefined;

  await rsvp.update(updatedData);
  return rsvp.toJSON() as EventsRsvp;
};

export const deleteRsvp = async (id: number): Promise<boolean> => {
  const deleted = await EventsRsvp.destroy({ where: { id } });
  return deleted > 0;
};

// get rsvp by user and event
export const getRsvpByUserAndEvent = async (userId: number, eventId: number): Promise<EventsRsvp | undefined> => {
  const rsvp = await EventsRsvp.findOne({
    where: { user_id: String(userId), event_id: String(eventId) }
  });
  return rsvp ? (rsvp.toJSON() as EventsRsvp) : undefined;
};