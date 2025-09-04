import { Payment } from '../models/payment.model';
import { MahberContribution } from '../models/mahber_contribution.model';
import { generateOneTimePaymentSuccessEmail } from '../controllers/email.controller';
import { Mahber } from '../models/mahber.model';
import { User } from '../models/user.model';
import { sendEmail, sendEmailHtml } from '../services/email.service'; // Adjust the import based on your project

export async function recordPayment({
  paymentId,
  receiptUrl,
  method,
  contributionId,
  memberId,
  mahberId,
  amount,
  status
}: {
  paymentId: string;
  receiptUrl?: string;
  method: 'subscription' | 'one-time';
  contributionId: number;
  memberId: number;
  mahberId: string;
  amount: number;
  status: string;
}) {
  await Payment.create({
    stripe_payment_id: paymentId,
    receipt_url: receiptUrl,
    method,
    contribution_id: contributionId.toString(),
    member_id: memberId,
    mahber_id: String(mahberId),
    amount,
    status
  });
  // Update contribution status
  await MahberContribution.update(
    { status: 'paid', amount_paid: amount },
    { where: { id: contributionId } }
  );
}

export async function recordOneTimePayment({
  paymentId,
  receiptUrl,
  contributionId,
  memberId,
  mahberId,
  amount,
  status
}: {
  paymentId: string;
  receiptUrl?: string;
  contributionId: number;
  memberId: number;
  mahberId: string;
  amount: number;
  status: string;
}) {
  await Payment.create({
    stripe_payment_id: paymentId,
    receipt_url: receiptUrl,
    method: 'one-time',
    contribution_id: contributionId.toString(),
    member_id: memberId,
    mahber_id: mahberId.toString(),
    amount,
    status
  });
  // Update contribution status
  await MahberContribution.update(
    { status: 'paid', amount_paid: amount },
    { where: { id: contributionId } }
  );

  // Send one-time payment success email
  const contribution = await MahberContribution.findByPk(contributionId);
  const user = await User.findByPk(memberId);
  const mahber = await Mahber.findByPk(contribution?.mahber_id);
  if (user && mahber) {
    const email = generateOneTimePaymentSuccessEmail(user, mahber, amount, receiptUrl || '');
    await sendEmailHtml(user.email, email.subject, email.html);
  }
}
