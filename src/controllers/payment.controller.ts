import { Response, Request } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { getUserById } from '../services/user.service';
import { getMahberById, updateMahber } from '../services/mahber.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { updateUser } from '../services/user.service';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-06-30.basil' });


export const getOnboardingLink = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahberId = Number(req.params.id);
  const mahber = await getMahberById(mahberId);
  if (!mahber) {
    res.status(404).json({ message: 'Mahber not found' });
    return;
  }
  if (!mahber || mahber.created_by !== req.user.id) {
    res.status(404).json({ message: 'Mahiber not found or not authorized' });
    return;
  }
  const user = await getUserById(Number(mahber.created_by));
  let accountId = mahber.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US", // or ET if Ethiopia is supported
      email: user?.email,
      capabilities: { transfers: { requested: true } },
    });
    accountId = account.id;
    mahber.stripe_account_id = accountId;
    await updateMahber(Number(req.params.id), mahber, req.user.id);
  }
  // Use refresh_url and return_url from request body, fallback to defaults if not provided
  const refreshUrl = req.body.refresh_url || "https://yenetech.com/stripe/refresh";
  const returnUrl = req.body.return_url || "https://yenetech.com/stripe/return";
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  res.json({
    accountLinkUrl: accountLink.url
  }); 
}

export const createPaymentIntent = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const mahberId = Number(req.params.id);
  const mahber = await getMahberById(mahberId);
  if (!mahber) {
    res.status(404).json({ message: 'Mahber not found' });
    return;
  }
  if (!mahber.stripe_account_id) {
    res.status(400).json({ message: 'Stripe account not set up for this Mahber' });
    return;
  }

  // Use the authenticated user as the payer (member)
  const user = await getUserById(Number(req.user.id));
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  if (!req.body.amount || typeof req.body.amount !== 'number' || req.body.amount <= 0) {
    res.status(400).json({ message: 'Invalid amount' });
    return;
  }

  // If user does not have a Stripe customer ID, create one and update the user
  if (!user.stripe_id) {
    const stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: user.full_name,
      phone: user.phone
    });
    await updateUser(user.id, { stripe_id: stripeCustomer.id });
    user.stripe_id = stripeCustomer.id;
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.body.amount, // Amount in cents
      currency: 'usd', // Change to your desired currency
      payment_method_types: req.body.payment_method_types || ['card'],
      customer: user.stripe_id, // Use the authenticated user's Stripe customer ID
      description: req.body.description || 'Mahber Contribution',
      transfer_data: {
        destination: mahber.stripe_account_id,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ message: 'Failed to create payment intent: ' + error });
  }
}