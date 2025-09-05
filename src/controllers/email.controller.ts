import { Mahber } from '../models/mahber.model';
import { User } from '../models/user.model';

export function generateRecurringPaymentNoticeEmail(user: User, mahber: Mahber, amount: number, dueDate: string) {
  return {
    subject: `Recurring Payment Notice for ${mahber.name}`,
    html: `
      <h2>Recurring Payment Notice</h2>
      <p>Dear ${user.full_name},</p>
      <p>This is a reminder that your recurring contribution of <strong>${amount}</strong> to <strong>${mahber.name}</strong> is due on <strong>${dueDate}</strong>.</p>
      <p>Please ensure your payment method is up to date.</p>
      <p>Thank you,<br/>Mahber Team</p>
    `
  };
}

export function generateOneTimePaymentSuccessEmail(user: User, mahber: Mahber, amount: number, receiptUrl: string) {
  return {
    subject: `Payment Successful for ${mahber.name}`,
    html: `
      <h2>Payment Successful</h2>
      <p>Dear ${user.full_name},</p>
      <p>Your one-time payment of <strong>${amount}</strong> to <strong>${mahber.name}</strong> was successful.</p>
      <p>You can view your receipt <a href="${receiptUrl}">here</a>.</p>
      <p>Thank you for your contribution!</p>
      <p>Mahber Team</p>
    `
  };
}

export function generateContributionChangeNoticeEmail(
  user: User,
  mahber: Mahber,
  oldParams: { amount: number; unit: string; frequency: number },
  newParams: { amount: number; unit: string; frequency: number },
  effectiveDate: string
) {
  let changes: string[] = [];
  if (oldParams.amount !== newParams.amount) {
    changes.push(`Amount: <strong>${oldParams.amount}</strong> → <strong>${newParams.amount}</strong>`);
  }
  if (oldParams.unit !== newParams.unit) {
    changes.push(`Unit: <strong>${oldParams.unit}</strong> → <strong>${newParams.unit}</strong>`);
  }
  if (oldParams.frequency !== newParams.frequency) {
    changes.push(`Frequency: <strong>${oldParams.frequency}</strong> → <strong>${newParams.frequency}</strong>`);
  }

  const changesHtml = changes.length
    ? `<ul><li>${changes.join('</li><li>')}</li></ul>`
    : `<p>No changes detected.</p>`;

  return {
    subject: `Contribution Change Notice for ${mahber.name}`,
    html: `
      <h2>Contribution Change Notice</h2>
      <p>Dear ${user.full_name},</p>
      <p>The contribution terms for <strong>${mahber.name}</strong> have changed, effective <strong>${effectiveDate}</strong>:</p>
      ${changesHtml}
      <p>This may affect your subscription and future payments. If you have questions, please contact your Mahber administrator.</p>
      <p>Mahber Team</p>
    `
  };
}

export function generateMahberJoinConfirmationEmail(user: User, mahber: Mahber) {
  return {
    subject: `Welcome to ${mahber.name}`,
    html: `
      <h2>Welcome to ${mahber.name}!</h2>
      <p>Dear ${user.full_name},</p>
      <p>You have successfully joined <strong>${mahber.name}</strong>.</p>
      <p>We are glad to have you as a member.</p>
      <p>Mahber Team</p>
    `
  };
}

export function generateForgotPasswordEmail(user: User, linkToken: string) {
  return {
    subject: 'Reset Your Mahber Password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Dear ${user.full_name},</p>
      <p>We received a request to reset your Mahber account password.</p>
      <p>Please use the verification code below:</p>
      <p style="color: #888;">This code will expire in 30 minutes.</p>
      <div style="font-size: 20px; font-weight: bold; letter-spacing: 2px; margin-bottom: 16px;">
        ${linkToken}
      </div>
      <p>If you did not request this, please ignore this email.</p>
      <p>Thank you,<br/>Mahber Team</p>
    `
  };
}export function generateEmailVerificationEmail(user: User) {
  return {
    subject: 'Verify your Mahber account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <p>Thank you for registering with Mahber! To complete your registration, please verify your account.</p>
        <h2>Verify your Mahber account</h2>
        <p>Use the verification code below:</p>
        <div style="font-size: 20px; font-weight: bold; letter-spacing: 2px; margin-bottom: 16px;">
          ${user.link_token}
        </div>
        <p style="color: #888;">This code will expire in 30 minutes.</p>
      </div>
    `
  };
}
