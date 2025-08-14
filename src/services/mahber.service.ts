import { Mahber } from '../models/mahber.model';
import { Member } from '../models/member.model';
import { MahberContributionTerm } from '../models/mahber_contribution_term.model';
import sequelize from '../config/db';
import { Op } from 'sequelize';
import Stripe from 'stripe';
import { Sequelize } from 'sequelize';
import { generateContributionChangeNoticeEmail } from '../controllers/email.controller';
import { sendEmail, sendEmailHtml } from '../services/email.service'; // Adjust the import based on your project structure
import { User } from '../models/user.model';
import { MahberContribution } from '../models/mahber_contribution.model';

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
      // description: payload.description,
      metadata: {
        contribution_unit: payload.contribution_unit || '',
        contribution_frequency: payload.contribution_frequency || '',
        contribution_amount: payload.contribution_amount || '',
        contribution_start_date: payload.effective_from || '',
        affiliation: payload.affiliation || ''
      }
    });

    // Create Stripe price if not present in payload
    let priceId = payload.stripe_price_id;
    if (!priceId) {
      const recurring =
        payload.contribution_frequency && payload.contribution_unit
          ? {
              interval: payload.contribution_unit,
              interval_count: Number(payload.contribution_frequency)
            }
          : undefined;
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(Number(payload.contribution_amount) * 100), // Stripe expects amount in cents
        currency: 'usd', // or use payload.currency if available
        recurring
      });
      priceId = price.id;
    }

    // Extract Mahber fields
    const mahberFields = {
      name: payload.name,
      created_by: payload.created_by,
      description: payload.description || payload.desccription || '', // Accept both keys
      profile: payload.profile, // include profile if present
      stripe_account_id: '',
      stripe_product_id: product.id, // <-- set product id
      stripe_price_id: priceId,      // <-- set price id
      stripe_status: 'inactive', // ensure default is 'inactive'
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
      featured: payload.is_featured || "false",
      promoted: payload.is_promoted || "false",
      visibility: payload.visibility || 'public', // default to public if not provided
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

    console.log(`Created Mahber ${mahber.id} with contribution term starting from ${payload.effective_from}`);
    console.log(`contribution terms: ${JSON.stringify(termFields)}`);

    // Only create contribution term if all required fields are present
    let term = null;
    if (
      payload.contribution_amount !== undefined &&
      payload.contribution_frequency !== undefined &&
      payload.contribution_unit &&
      payload.effective_from
    ) {
      term = await MahberContributionTerm.create(termFields, { transaction: t });
    }

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

function castMahberContributionAmount<T extends { contribution_amount?: any }>(mahber: T): T {
  return {
    ...mahber,
    contribution_amount: mahber.contribution_amount !== undefined && mahber.contribution_amount !== null
      ? Number(mahber.contribution_amount)
      : 0
  };
}

export const getMahbersByUser = async (userId: number): Promise<any[]> => {
  const mahbers = await Mahber.findAll({ where: { created_by: userId } });
  const mahberList = mahbers.map(m => castMahberContributionAmount(m.toJSON() as Mahber));
  const counts = await getMemberStatusCounts(mahberList.map(m => m.id));

  // For each Mahber, calculate potential and paid contributions for the current period
  const result = await Promise.all(
    mahberList.map(async m => {
      // Find the latest period number for this Mahber
      const latestContribution = await MahberContribution.findOne({
        where: { mahber_id: m.id },
        order: [['period_number', 'DESC']]
      });
      const currentPeriod = latestContribution ? latestContribution.period_number : null;

      // Potential: sum of amount_due for current period
      // Paid: sum of amount_paid for current period
      let potential_contribution = 0;
      let paid_contribution = 0;
      if (currentPeriod !== null) {
        const contributions = await MahberContribution.findAll({
          where: { mahber_id: m.id, period_number: currentPeriod }
        });
        potential_contribution = contributions.reduce((sum, c) => sum + Number(c.amount_due || 0), 0);
        paid_contribution = contributions.reduce((sum, c) => sum + Number(c.amount_paid || 0), 0);
      }

      return {
        ...m,
        memberCounts: counts[m.id] || { joined: 0, invited: 0, requested: 0, rejected: 0 },
        potential_contribution,
        paid_contribution
      };
    })
  );

  return result;
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

  const mahberList = mahbers.map(m => castMahberContributionAmount(m.toJSON() as Mahber));
  const counts = await getMemberStatusCounts(mahberList.map(m => m.id));

  // Map status and payment method from member to mahber in the response
  const statusMap: Record<number, string> = {};
  const roleMap: Record<number, string> = {};
  const paymentMethodMap: Record<number, string> = {};
  members.forEach(m => {
    statusMap[Number(m.edir_id)] = m.status;
    if (m.status === 'accepted') {
      roleMap[Number(m.edir_id)] = m.role;
    }
    paymentMethodMap[Number(m.edir_id)] = m.stripe_subscription_id ? 'subscription' : 'one_time';
  });

  return mahberList.map(m => ({
    ...m,
    memberStatus: statusMap[m.id] || 'none', // accepted, invited, requested, rejected, left, none
    memberRole: roleMap[m.id] || null,       // admin, member, etc. (only if accepted)
    memberCounts: counts[m.id] || { joined: 0, invited: 0, requested: 0, rejected: 0 },
    payment_method: paymentMethodMap[m.id] || 'one_time'
  }));
};

export const getMahberById = async (id: number): Promise<Mahber | undefined> => {
  const mahber = await Mahber.findByPk(id);
  return mahber ? castMahberContributionAmount(mahber.toJSON() as Mahber) : undefined;
};

export const getAllMahbers = async (
  search: string = '',
  page: number = 1,
  perPage: number = 10
): Promise<{ data: any[]; total: number; page: number; perPage: number }> => {
  
  const where: any = {
    visibility: { [Op.ne]: 'private' }
  };

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

  const mahberList = rows.map(m => castMahberContributionAmount(m.toJSON() as Mahber));
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
  let stripe_price_id = mahber.stripe_price_id;

  if (shouldUpdateProduct) {
    // Create a new Stripe product with updated info
    const product = await stripe.products.create({
      name: updated.name || mahber.name,
      // description: updated.description || mahber.description,
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

    // Create a new Stripe price if missing or contribution fields changed
    const interval = updated.contribution_unit || mahber.contribution_unit;
    const interval_count = updated.contribution_frequency || mahber.contribution_frequency;
    const recurring = {
      interval: interval as Stripe.Price.Recurring.Interval,
      interval_count: Number(interval_count)
    };
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(Number(updated.contribution_amount || mahber.contribution_amount) * 100),
      currency: 'usd',
      recurring: recurring
    });
    stripe_price_id = price.id;
    updated.stripe_price_id = stripe_price_id;
  } else if (!stripe_price_id) {
    const interval = updated.contribution_unit || mahber.contribution_unit;
    const interval_count = updated.contribution_frequency || mahber.contribution_frequency;
    const recurring = {
      interval: interval as Stripe.Price.Recurring.Interval,
      interval_count: Number(interval_count)
    };
    const price = await stripe.prices.create({
      product: stripe_product_id,
      unit_amount: Math.round(Number(mahber.contribution_amount) * 100),
      currency: 'usd',
      recurring: recurring 
    });
    stripe_price_id = price.id;
    updated.stripe_price_id = stripe_price_id;
  }

  await mahber.update({
    ...updated,
    updated_by: userId,
    updated_at: new Date(),
    stripe_product_id, // always set to latest
    stripe_price_id    // always set to latest
  });

  // After updating, notify all members if contribution params changed
  if (
    (updated.contribution_amount && updated.contribution_amount !== mahber.contribution_amount) ||
    (updated.contribution_unit && updated.contribution_unit !== mahber.contribution_unit) ||
    (updated.contribution_frequency && updated.contribution_frequency !== mahber.contribution_frequency)
  ) {
    const members = await Member.findAll({ where: { edir_id: id, status: 'accepted' } });
    for (const member of members) {
      const user = await User.findByPk(member.member_id);
      if (user) {
        const email = generateContributionChangeNoticeEmail(
          user,
          mahber,
          {
            amount: Number(mahber.contribution_amount),
            unit: String(mahber.contribution_unit),
            frequency: Number(mahber.contribution_frequency)
          },
          {
            amount: Number(updated.contribution_amount ?? mahber.contribution_amount),
            unit: String(updated.contribution_unit ?? mahber.contribution_unit),
            frequency: Number(updated.contribution_frequency ?? mahber.contribution_frequency)
          },
          String(updated.contribution_start_date || mahber.contribution_start_date)
        );
        await sendEmailHtml(user.email, email.subject, email.html);
      }
    }
  }

  return mahber.toJSON() as Mahber;
};

export const deleteMahber = async (id: number, userId: number): Promise<boolean> => {
  const deleted = await Mahber.destroy({ where: { id, created_by: userId } });
  return deleted > 0;
};

export const checkMahberStripeAccount = async (mahberId: number) => {
  const mahber = await Mahber.findByPk(mahberId);
  if (!mahber) return false;

  const account = await stripe.accounts.retrieve(mahber.stripe_account_id);
  if (account && account.deleted) {
    // If the account was deleted, we should remove the stripe_account_id from the Mahber
    await mahber.update({ stripe_account_id: '' });
    return false;
  }
  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
    // If the account is fully set up, we can return true
    await mahber.update({ stripe_status: 'active' });
    return true;
  }else{
    // If the account is not fully set up, we can return false
    await mahber.update({ stripe_status: 'pending' });
    return false;
  }
}


export const getFeaturedMahbers = async (
  search: string = '',
  page: number = 1,
  perPage: number = 10
): Promise<{ data: any[]; total: number; page: number; perPage: number }> => {
  
  const where: any = {
    visibility: { [Op.ne]: 'private' },
    featured: "true"
  };

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

  const mahberList = rows.map(m => castMahberContributionAmount(m.toJSON() as Mahber));
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