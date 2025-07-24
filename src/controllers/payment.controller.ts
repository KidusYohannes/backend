import { Response, Request } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { getUserById, updateUser } from '../services/user.service';
import { getMahberById, updateMahber } from '../services/mahber.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

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

// Helper to get or update user's payment methods (now on user, not member)
async function getOrUpdateUserPaymentMethods(user: any, newMethod?: any, paymentType?: string) {
  let paymentMethods: any = {};
  if (user.payment_methods) {
    try {
      paymentMethods = JSON.parse(user.payment_methods);
    } catch {
      paymentMethods = {};
    }
  }

  if (newMethod && paymentType) {
    paymentMethods[paymentType] = newMethod;
    await updateUser(user.id, { payment_methods: JSON.stringify(paymentMethods) });
  }

  return paymentMethods;
}

// One-time payment
export const createOneTimePayment = async (req: AuthenticatedRequest, res: Response) => {
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

  const user = await getUserById(Number(req.user.id));
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  if (!req.body.amount || typeof req.body.amount !== 'number' || req.body.amount <= 0) {
    res.status(400).json({ message: 'Invalid amount' });
    return;
  }

  // Ensure Stripe customer exists
  if (!user.stripe_id) {
    const stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: user.full_name,
      phone: user.phone
    });
    await updateUser(user.id, { stripe_id: stripeCustomer.id });
    user.stripe_id = stripeCustomer.id;
  }

  // Retrieve or update payment method
  let paymentMethodId = req.body.payment_method_id;
  let savePaymentMethod = req.body.save_payment_method;
  let paymentMethods = await getOrUpdateUserPaymentMethods(user);

  // If user wants to use a saved payment method
  if (!paymentMethodId && req.body.use_saved && paymentMethods && paymentMethods['one_time']) {
    paymentMethodId = paymentMethods['one_time'].id;
  }

  // If user provides a new payment method and wants to save it
  if (paymentMethodId && savePaymentMethod) {
    await getOrUpdateUserPaymentMethods(user, { id: paymentMethodId }, 'one_time');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.body.amount,
      currency: 'usd',
      payment_method_types: ['card'],
      customer: user.stripe_id,
      payment_method: paymentMethodId,
      description: req.body.description || 'Mahber Contribution',
      transfer_data: {
        destination: mahber.stripe_account_id,
      },
      // If using a saved payment method, set off_session and confirm
      ...(paymentMethodId ? { off_session: true, confirm: true } : {})
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentMethods });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ message: 'Failed to create payment intent: ' + error });
  }
};

// Subscription payment
export const createSubscriptionPayment = async (req: AuthenticatedRequest, res: Response) => {
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

  const user = await getUserById(Number(req.user.id));
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  const { price_id, payment_method_id, save_payment_method, use_saved } = req.body;
  if (!price_id) {
    res.status(400).json({ message: 'Missing price_id for subscription' });
    return;
  }

  // Ensure Stripe customer exists
  if (!user.stripe_id) {
    const stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: user.full_name,
      phone: user.phone
    });
    await updateUser(user.id, { stripe_id: stripeCustomer.id });
    user.stripe_id = stripeCustomer.id;
  }

  // Retrieve or update payment method
  let finalPaymentMethodId = payment_method_id;
  let paymentMethods = await getOrUpdateUserPaymentMethods(user);

  // If user wants to use a saved payment method
  if (!finalPaymentMethodId && use_saved && paymentMethods && paymentMethods['subscription']) {
    finalPaymentMethodId = paymentMethods['subscription'].id;
  }

  // If user provides a new payment method and wants to save it
  if (finalPaymentMethodId && save_payment_method) {
    await getOrUpdateUserPaymentMethods(user, { id: finalPaymentMethodId }, 'subscription');
  }

  try {
    const subscription = await stripe.subscriptions.create({
      customer: user.stripe_id,
      items: [{ price: price_id }],
      default_payment_method: finalPaymentMethodId,
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: save_payment_method ? 'on_subscription' : 'off',
      },
      expand: ['latest_invoice.payment_intent'],
    });
    res.json({
      subscriptionId: subscription.id,
      clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      paymentMethods
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ message: 'Failed to create subscription: ' + error });
  }
};