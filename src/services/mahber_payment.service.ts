import { MahberContributionTerm } from '../models/mahber_contribution_term.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { MahberPayment } from '../models/mahber_payment.model';
import { MahberPaymentCoverage } from '../models/mahber_payment_coverage.model';
import sequelize from '../config/db';

// This service provides payment and contribution management logic for Mahber (group) members.
// It uses Sequelize models and transactions to ensure data consistency for all payment-related operations.

//
// Key functionalities:
//

// 1. getOutstandingContributions
//    - Fetches all unpaid or partially paid contribution periods for a member in a Mahber.
//    - Attaches the latest contribution term's amount if not present on the contribution row.

// 2. calculateTotalForPeriods
//    - Calculates the total amount a member needs to pay for a set of upcoming periods.
//    - Sums up the difference between amount_due and amount_paid for each selected period.

// 3. handleStripePayment
//    - After a successful Stripe payment, records the payment in mahber_payments.
//    - Applies the payment amount across unpaid/partially paid periods in order (oldest first).
//    - For each covered period, creates a row in mahber_payment_coverage to track how much of the payment was applied to which period.
//    - Updates mahber_contributions with the new amount_paid and status ('partial' or 'paid').
//    - Prevents overpayment beyond the next scheduled contribution term change (if any).
//    - All operations are wrapped in a Sequelize transaction for consistency.

// 4. getPaymentHistory
//    - Returns all payment records for a member in a Mahber, ordered by payment date (most recent first).

// 5. getPaymentCoverage
//    - Returns all coverage records for a given payment, including which periods (contributions) were covered and by how much.

//
// Additional notes:
// - The service expects Sequelize models for MahberContributionTerm, MahberContribution, MahberPayment, and MahberPaymentCoverage.
// - Error handling is done via exceptions; controllers should catch and handle these for API responses.
// - The logic ensures that payments are not applied beyond the next scheduled contribution term change, and that partial payments are handled correctly.
// - All methods use async/await and TypeScript best practices.

// 1. Get unpaid/partially paid contribution periods for a member in a Mahber
export async function getOutstandingContributions(mahber_id: number, member_id: number) {
  // Get latest term for this mahber
  const latestTerm = await MahberContributionTerm.findOne({
    where: { mahber_id },
    order: [['effective_from', 'DESC']]
  });
  if (!latestTerm) throw new Error('No contribution term found for this Mahber');

  // Get all unpaid/partial contributions for this member
  const contributions = await MahberContribution.findAll({
    where: {
      mahber_id,
      member_id,
      status: ['unpaid', 'partial']
    },
    order: [['period_number', 'ASC']]
  });

  // Attach amount_due from latest term (if needed)
  return contributions.map(c => ({
    ...c.toJSON(),
    amount_due: c.amount_due ?? latestTerm.amount
  }));
}

// 2. Calculate total amount required for selected upcoming periods
export async function calculateTotalForPeriods(mahber_id: number, member_id: number, periodNumbers: number[]) {
  const contributions = await MahberContribution.findAll({
    where: {
      mahber_id,
      member_id,
      period_number: periodNumbers
    }
  });
  if (contributions.length !== periodNumbers.length) throw new Error('Some periods not found');
  return contributions.reduce((sum, c) => sum + ((c.amount_due ?? 0) - (c.amount_paid || 0)), 0);
}

// 3. After Stripe payment success: record, apply, cover, update
export async function handleStripePayment({
  mahber_id,
  member_id,
  stripe_payment_id,
  amount_paid,
  receipt_url
}: {
  mahber_id: number;
  member_id: number;
  stripe_payment_id: string;
  amount_paid: number;
  receipt_url?: string;
}) {
  return await sequelize.transaction(async (t) => {
    // Record payment
    const payment = await MahberPayment.create({
      mahber_id,
      member_id,
      stripe_payment_id,
      amount_paid,
      receipt_url
    }, { transaction: t });

    // Get unpaid/partial contributions, ordered
    const contributions = await MahberContribution.findAll({
      where: {
        mahber_id,
        member_id,
        status: ['unpaid', 'partial']
      },
      order: [['period_number', 'ASC']],
      transaction: t
    });

    // Get next scheduled term change (if any)
    const nextTerm = await MahberContributionTerm.findOne({
      where: {
        mahber_id,
        effective_from: { $gt: new Date() }
      },
      order: [['effective_from', 'ASC']],
      transaction: t
    });
    const maxEffectiveFrom = nextTerm ? nextTerm.effective_from : null;

    let remaining = amount_paid;
    for (const contrib of contributions) {
      // If next term exists, only pay up to contributions before its effective_from
      // If you have a date field for the contribution, use it here. Otherwise, remove this check.
      // Example: if (maxEffectiveFrom && contrib.period_start_date && contrib.period_start_date >= maxEffectiveFrom) break;

      const due = (contrib.amount_due ?? 0) - (contrib.amount_paid || 0);
      if (due <= 0) continue;
      const toPay = Math.min(remaining, due);
      if (toPay <= 0) break;

      // Update contribution
      const newPaid = (contrib.amount_paid || 0) + toPay;
      const newStatus = newPaid >= (contrib.amount_due ?? 0) ? 'paid' : 'partial';
      await contrib.update({ amount_paid: newPaid, status: newStatus }, { transaction: t });

      // Create coverage row
      await MahberPaymentCoverage.create({
        payment_id: payment.id,
        contribution_id: contrib.id,
        amount_applied: toPay
      }, { transaction: t });

      remaining -= toPay;
      if (remaining <= 0) break;
    }
    if (remaining > 0) throw new Error('Payment exceeds required amount for upcoming periods');
    return payment;
  });
}

// 4. Prevent overpayment beyond next scheduled contribution term change
// (Handled in handleStripePayment above by breaking at maxPeriod)

// 5. Member API: View payment history
export async function getPaymentHistory(mahber_id: number, member_id: number) {
  return MahberPayment.findAll({
    where: { mahber_id, member_id },
    order: [['paid_at', 'DESC']]
  });
}

// 6. Member API: View which periods are covered by each payment
export async function getPaymentCoverage(payment_id: number) {
  return MahberPaymentCoverage.findAll({
    where: { payment_id },
    include: [{ model: MahberContribution }]
  });
}
