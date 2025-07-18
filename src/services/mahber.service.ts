import { Mahber } from '../models/mahber.model';
import { Member } from '../models/member.model';
import { MahberContributionTerm } from '../models/mahber_contribution_term.model';
import sequelize from '../config/db';
import { Op } from 'sequelize';

export const createMahber = async (mahber: Omit<Mahber, 'id' | 'created_at' | 'updated_at'>): Promise<Mahber> => {
  const created = await Mahber.create(mahber);
  return created.toJSON() as Mahber;
};

// Accepts a single payload with both Mahber and initial contribution term data
export const createMahberWithContributionTerm = async (payload: any) => {
  return await sequelize.transaction(async (t) => {
    const now = new Date();
    // Extract Mahber fields
    const mahberFields = {
      name: payload.name,
      created_by: payload.created_by,
      description: payload.description,
      stripe_account_id: '',
      type: payload.type,
      contribution_unit: payload.contribution_unit,
      contribution_frequency: payload.contribution_frequency,
      contribution_amount: payload.contribution_amount,
      contribution_start_date: payload.effective_from,
      affiliation: payload.affiliation,
      created_at: now,
      updated_at: now
    };

    // Create Mahber
    const mahber = await Mahber.create(mahberFields, { transaction: t });

    // Extract ContributionTerm fields
    const termFields = {
      mahber_id: mahber.id,
      amount: payload.contribution_amount,
      frequency: payload.contribution_frequency,
      unit: payload.contribution_unit,
      effective_from: payload.effective_from,
      status: 'active'
    };

    // Create first contribution term for this Mahber
    const term = await MahberContributionTerm.create(termFields, { transaction: t });

    // Optionally, update Mahber with the term info if you want to keep it in sync
    // await mahber.update({
    //   contribution_unit: term.unit,
    //   contribution_frequency: term.frequency,
    //   contribution_amount: term.amount,
    //   contribution_start_date: term.effective_from
    // }, { transaction: t });

    return { mahber, contributionTerm: term };
  });
};

export const getMahbersByUser = async (userId: number): Promise<Mahber[]> => {
  const mahbers = await Mahber.findAll({ where: { created_by: userId } });
  return mahbers.map(m => m.toJSON() as Mahber);
};

export const getJoinedMahbers = async (userId: number): Promise<Mahber[]> => {
  // Use a subquery to fetch Mahbers where the user is an accepted member
  const user_id = String(userId);
  const mahbers = await Mahber.findAll({
    where: {
      id: {
        [Op.in]: sequelize.literal(`(
          SELECT edir_id::int FROM members WHERE member_id = '${user_id}' AND status = 'accepted'
        )`)
      }
    },
    // attributes: [
    //   'id', 'name', 'type', 'affiliation',
    //   'contribution_unit', 'contribution_frequency',
    //   'contribution_amount', 'contribution_start_date'
    // ]
  });
  console.log('Joined mahbers:', mahbers);
  return mahbers.map(m => m.toJSON() as Mahber);
};

export const getMahberById = async (id: number): Promise<Mahber | undefined> => {
  const mahber = await Mahber.findByPk(id);
  return mahber ? (mahber.toJSON() as Mahber) : undefined;
};

export const getAllMahbers = async (
  search: string = '',
  page: number = 1,
  perPage: number = 10
): Promise<{ data: Mahber[]; total: number; page: number; perPage: number }> => {
  const where: any = {};

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { type: { [Op.iLike]: `%${search}%` } },
      { affiliation: { [Op.iLike]: `%${search}%` } }
      // Add more fields as needed for global search
    ];
  }

  const offset = (page - 1) * perPage;

  const { rows, count } = await Mahber.findAndCountAll({
    where,
    offset,
    limit: perPage,
    order: [['id', 'DESC']]
  });

  return {
    data: rows.map(m => m.toJSON() as Mahber),
    total: count,
    page,
    perPage
  };
}

export const updateMahber = async (id: number, updated: Partial<Mahber>, userId: number): Promise<Mahber | undefined> => {
  const mahber = await Mahber.findOne({ where: { id, created_by: userId } });
  if (!mahber) return undefined;
  await mahber.update({
    ...updated,
    updated_by: userId,
    updated_at: new Date()
  });
  return mahber.toJSON() as Mahber;
};

export const deleteMahber = async (id: number, userId: number): Promise<boolean> => {
  const deleted = await Mahber.destroy({ where: { id, created_by: userId } });
  return deleted > 0;
};
