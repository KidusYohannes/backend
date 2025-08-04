# Mahber App Backend Documentation

## Overview

Mahber App is a backend system for managing Mahbers (social groups), member contributions, and payments using Stripe. It supports recurring and one-time payments, automated contribution generation, and scheduled checks for payment and Stripe account status.

---

## Main Features

- **Mahber Management:** Create, update, and delete Mahbers with Stripe integration.
- **Member Management:** Invite, join, ban/unban, and track member status.
- **Contribution Management:** Automatically generate and track member contributions per period.
- **Payment Handling:** Supports Stripe subscription and one-time payments, with payment tracking.
- **Email Notifications:** Sends emails for activation, payment, contribution changes, and membership events.
- **Scheduled Tasks:** Cron jobs for Stripe account/product/price checks, subscription sync, and contribution reminders.

---

## Models

### Mahber (`mahber.model.ts`)
- Represents a social group.
- Fields: `id`, `name`, `created_by`, `stripe_account_id`, `stripe_product_id`, `stripe_price_id`, `stripe_status`, etc.

### Member (`member.model.ts`)
- Represents a user in a Mahber.
- Fields: `id`, `member_id`, `edir_id`, `role`, `status`, `stripe_subscription_id`, `stripe_session_id`, etc.

### MahberContributionTerm (`mahber_contribution_term.model.ts`)
- Defines contribution rules for a Mahber.
- Fields: `id`, `mahber_id`, `amount`, `frequency`, `unit`, `effective_from`, `status`.

### MahberContribution (`mahber_contribution.model.ts`)
- Tracks individual member contributions per period.
- Fields: `id`, `mahber_id`, `member_id`, `period_number`, `contribution_term_id`, `amount_due`, `amount_paid`, `status`, `period_start_date`.

### Payment (`payment.model.ts`)
- Records Stripe payments.
- Fields: `id`, `payment_id`, `receipt_url`, `method`, `contribution_id`, `member_id`, `amount`, `status`, `created_at`.

---

## Stripe Integration

- **Account Onboarding:** Each Mahber can have a Stripe account for payouts.
- **Product/Price Creation:** Stripe products/prices are created for Mahber contributions.
- **Subscription Payments:** Members can subscribe; subscription IDs are tracked.
- **One-Time Payments:** Members can make single payments; payment intent IDs are tracked.
- **Webhook Support:** Stripe webhooks can be used for payment success/failure events.

---

## Scheduled Tasks (Cron Jobs)

- **Stripe Account Status Check:**  
  Runs every 2 hours. Verifies Mahber Stripe account status and updates Mahber records.

- **Stripe Product/Price Check:**  
  Runs every 2 hours. Ensures Mahbers have Stripe product/price IDs, creates them if missing.

- **Stripe Subscription Sync:**  
  Runs every 2 hours. Syncs Stripe subscription IDs to member records using session IDs.

- **Contribution Reminder:**  
  Runs daily at 8am. Finds unpaid contributions past due date and sends email reminders.

- **Contribution Pre-generation:**  
  (Recommended) Generates upcoming contributions for all members based on Mahber frequency/unit.

---

## Email Notifications

- **Activation Email:** Sent when a user registers.
- **Recurring Payment Notice:** Reminder for upcoming recurring payments.
- **One-Time Payment Success:** Confirmation and receipt for successful one-time payments.
- **Contribution Change Notice:** Notifies members of changes in contribution amount.
- **Mahber Join Confirmation:** Sent when a user joins a Mahber.

---

## API Endpoints

- **Auth:** `/login`, `/activate`
- **Mahber:** `/mahber/create`, `/mahber/update`, `/mahber/delete`
- **Member:** `/member/invite`, `/member/join`, `/member/respond`, `/member/ban`, `/member/unban`
- **Contribution:** `/contribution/create-initial`, `/contribution/create-period`
- **Payment:** `/payments/:id/onboarding-link`, `/checkout/:id/:payment_type`
- **Stripe Webhook:** `/stripe/webhook`

---

## Payment Flow

1. **Subscription:**  
   - Member subscribes via Stripe Checkout.
   - `stripe_session_id` and `stripe_subscription_id` are stored in Member.
   - Payment record created and contribution marked as paid.

2. **One-Time Payment:**  
   - Member pays via Stripe Checkout.
   - `paymentIntentId` is tracked.
   - Payment record created and contribution marked as paid.

---

## Contribution Logic

- Contributions are generated for each member per period based on Mahber's contribution term (`frequency`, `unit`, `amount`).
- Contributions are marked as `unpaid` by default and updated to `paid` upon successful payment.

---

## Failure Handling

- Stripe webhook and cron jobs check for missed or failed payments.
- Email notifications are sent to users for failed payments and reminders.

---

## Environment Variables

- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`
- `FRONTEND_URL`
- `SUCCESS_URL`, `CANCEL_URL`

---

## Extending the System

- Add more email templates in `email.controller.ts`.
- Implement additional webhooks for Stripe events.
- Add admin dashboards or reporting endpoints as needed.

---

## Getting Started

1. Install dependencies:  
   `npm install`
2. Set up environment variables in `.env`.
3. Run migrations to set up the database.
4. Start the backend server:  
   `npm start`

---

## Contact

For support or questions, contact the Mahber App team at [info@demo2.yenetech.com](mailto:info@demo2.yenetech.com).

