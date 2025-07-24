import { Mahber } from '../models/mahber.model';
import { Member } from '../models/member.model';
import { MahberContributionTerm } from '../models/mahber_contribution_term.model';
import sequelize from '../config/db';
import { Op } from 'sequelize';
import Stripe from 'stripe';
import { Sequelize } from 'sequelize';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });

export const createMahber = async (mahber: Omit<Mahber, 'id' | 'created_at' | 'updated_at'>): Promise<Mahber> => {
  const created = await Mahber.create(mahber);
  return created.toJSON() as Mahber;
};

// Accepts a single payload with both Mahber and initial contribution term data
export const createMahberWithContributionTerm = async (payload: any) => {
  return await sequelize.transaction(async (t) => {
    const now = new Date();

    // Create Stripe product for this Mahber
    const product = await stripe.products.create({
      name: payload.name,
      description: payload.description,
      metadata: {
        contribution_unit: payload.contribution_unit || '',
        contribution_frequency: payload.contribution_frequency || '',
        contribution_amount: payload.contribution_amount || '',
        contribution_start_date: payload.effective_from || '',
        affiliation: payload.affiliation || ''
      }
    });

    // Extract Mahber fields
    const mahberFields = {
      name: payload.name,
      created_by: payload.created_by,
      description: payload.description,
      stripe_account_id: '',
      stripe_product_id: product.id, // <-- set product id
      type: payload.type,
      contribution_unit: payload.contribution_unit,
      contribution_frequency: payload.contribution_frequency,
      contribution_amount: payload.contribution_amount,
      contribution_start_date: payload.effective_from,
      affiliation: payload.affiliation,
      country: payload.country,
      state: payload.state,
      city: payload.city,
      address: payload.address,
      zip_code: payload.zip_code,
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

// Helper to get member counts for a list of mahber IDs
async function getMemberStatusCounts(mahberIds: number[]): Promise<Record<number, any>> {
  if (!mahberIds.length) return {};
  const rows = await Member.findAll({
    attributes: [
      'edir_id',
      'status',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
    ],
    where: {
      edir_id: { [Op.in]: mahberIds.map(String) }
    },
    group: ['edir_id', 'status']
  });

  // Build a map: { [mahberId]: { joined, invited, requested, rejected } }
  const result: Record<number, any> = {};
  for (const row of rows) {
    const edir_id = Number(row.get('edir_id'));
    const status = row.get('status');
    const count = Number(row.get('count'));
    if (!result[edir_id]) {
      result[edir_id] = { joined: 0, invited: 0, requested: 0, rejected: 0 };
    }
    if (status === 'accepted') result[edir_id].joined = count;
    if (status === 'invited') result[edir_id].invited = count;
    if (status === 'requested') result[edir_id].requested = count;
    if (status === 'rejected') result[edir_id].rejected = count;
  }
  return result;
}

export const getMahbersByUser = async (userId: number): Promise<any[]> => {
  const mahbers = await Mahber.findAll({ where: { created_by: userId } });
  const mahberList = mahbers.map(m => m.toJSON() as Mahber);
  const counts = await getMemberStatusCounts(mahberList.map(m => m.id));
  return mahberList.map(m => ({
    ...m,
    memberCounts: counts[m.id] || { joined: 0, invited: 0, requested: 0, rejected: 0 }
  }));
};

export const getJoinedMahbers = async (userId: number): Promise<any[]> => {
  const user_id = String(userId);
  // Fetch all mahbers where the user is a member with accepted, invited, or requested status
  const members = await Member.findAll({
    where: {
      member_id: user_id,
      status: { [Op.in]: ['accepted', 'invited', 'requested'] }
    }
  });

  const mahberIds = members.map(m => Number(m.edir_id));
  if (!mahberIds.length) return [];

  const mahbers = await Mahber.findAll({
    where: { id: { [Op.in]: mahberIds } }
  });

  const mahberList = mahbers.map(m => m.toJSON() as Mahber);
  const counts = await getMemberStatusCounts(mahberList.map(m => m.id));

  // Map status from member to mahber in the response
  const statusMap: Record<number, string> = {};
  members.forEach(m => { statusMap[Number(m.edir_id)] = m.status; });

  return mahberList.map(m => ({
    ...m,
    memberStatus: statusMap[m.id] || null,
    memberCounts: counts[m.id] || { joined: 0, invited: 0, requested: 0, rejected: 0 }
  }));
};

export const getMahberById = async (id: number): Promise<Mahber | undefined> => {
  const mahber = await Mahber.findByPk(id);
  return mahber ? (mahber.toJSON() as Mahber) : undefined;
};

export const getAllMahbers = async (
  search: string = '',
  page: number = 1,
  perPage: number = 10
): Promise<{ data: any[]; total: number; page: number; perPage: number }> => {
  const where: any = {};

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { type: { [Op.iLike]: `%${search}%` } },
      { affiliation: { [Op.iLike]: `%${search}%` } },
      { country: { [Op.iLike]: `%${search}%` } },
      { state: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
      { zip_code: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const offset = (page - 1) * perPage;

  const { rows, count } = await Mahber.findAndCountAll({
    where,
    offset,
    limit: perPage,
    order: [['id', 'DESC']]
  });

  const mahberList = rows.map(m => m.toJSON() as Mahber);
  const counts = await getMemberStatusCounts(mahberList.map(m => m.id));
  const data = mahberList.map(m => ({
    ...m,
    memberCounts: counts[m.id] || { joined: 0, invited: 0, requested: 0, rejected: 0 }
  }));

  return {
    data,
    total: count,
    page,
    perPage
  };
}

export const updateMahber = async (id: number, updated: Partial<Mahber>, userId: number): Promise<Mahber | undefined> => {
  const mahber = await Mahber.findOne({ where: { id, created_by: userId } });
  if (!mahber) return undefined;

  // Check if contribution fields are being updated
  const contributionFields = ['contribution_unit', 'contribution_frequency', 'contribution_amount', 'contribution_start_date', 'affiliation', 'description', 'name'];
  const shouldUpdateProduct = contributionFields.some(field => field in updated);

  let stripe_product_id = mahber.stripe_product_id;

  if (shouldUpdateProduct) {
    // Create a new Stripe product with updated info
    const product = await stripe.products.create({
      name: updated.name || mahber.name,
      description: updated.description || mahber.description,
      metadata: {
        contribution_unit: updated.contribution_unit || mahber.contribution_unit || '',
        contribution_frequency: updated.contribution_frequency || mahber.contribution_frequency || '',
        contribution_amount: updated.contribution_amount || mahber.contribution_amount || '',
        contribution_start_date: updated.contribution_start_date || mahber.contribution_start_date || '',
        affiliation: updated.affiliation || mahber.affiliation || ''
      }
    });
    stripe_product_id = product.id;
    updated.stripe_product_id = stripe_product_id;
  }

  await mahber.update({
    ...updated,
    updated_by: userId,
    updated_at: new Date(),
    stripe_product_id // always set to latest
  });
  return mahber.toJSON() as Mahber;
};

export const deleteMahber = async (id: number, userId: number): Promise<boolean> => {
  const deleted = await Mahber.destroy({ where: { id, created_by: userId } });
  return deleted > 0;
};
