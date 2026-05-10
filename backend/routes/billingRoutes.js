import express from 'express';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import StripeWebhookEvent from '../models/StripeWebhookEvent.js';
import { isValidPlanType, PAID_PLAN_TYPES } from '../config/plans.js';
import { PLAN_TO_STRIPE_PRICE, stripe, stripeReady } from '../config/stripe.js';
import { syncFromCheckoutSession, syncFromStripeSubscription, setUserFreePlan } from '../services/subscriptionSyncService.js';

const router = express.Router();

const getPublicBaseUrl = () => process.env.APP_BASE_URL || 'https://orbitcloud.app';

const getSuccessUrl = () => process.env.STRIPE_SUCCESS_URL || `${getPublicBaseUrl()}/app/plans?checkout=success`;
const getCancelUrl = () => process.env.STRIPE_CANCEL_URL || `${getPublicBaseUrl()}/app/plans?checkout=cancel`;
const getPortalReturnUrl = () => process.env.STRIPE_BILLING_PORTAL_RETURN_URL || `${getPublicBaseUrl()}/app/settings`;

const ensureStripeReady = (req, res, next) => {
    if (!stripe || !stripeReady) {
        return res.status(503).json({ message: 'Stripe billing is not configured yet on the server.' });
    }
    return next();
};

router.use(authMiddleware);

router.get('/subscription', async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select(
            'planType limits planExpiresAt autoRenew pendingPlanType planChangeAt stripeCustomerId stripeSubscriptionId stripePriceId subscriptionStatus currentPeriodEnd'
        );
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        return res.json(user);
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching subscription state', error: error.message });
    }
});

router.post('/checkout-session', ensureStripeReady, async (req, res) => {
    try {
        const { planType } = req.body;
        if (!isValidPlanType(planType) || !PAID_PLAN_TYPES.includes(planType)) {
            return res.status(400).json({ message: 'Invalid paid plan selected.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                metadata: { userId: String(user._id) }
            });
            customerId = customer.id;
            user.stripeCustomerId = customerId;
            await user.save();
        }

        const priceId = PLAN_TO_STRIPE_PRICE[planType];
        if (!priceId) {
            return res.status(500).json({ message: `Missing Stripe price id for plan ${planType}` });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: getSuccessUrl(),
            cancel_url: getCancelUrl(),
            allow_promotion_codes: true,
            metadata: {
                userId: String(user._id),
                planType
            }
        });

        return res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create checkout session', error: error.message });
    }
});

router.post('/portal-session', ensureStripeReady, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (!user.stripeCustomerId) {
            return res.status(400).json({ message: 'No Stripe customer linked to this account yet.' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: getPortalReturnUrl()
        });

        return res.json({ url: session.url });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create customer portal session', error: error.message });
    }
});

router.get('/payment-method', ensureStripeReady, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('stripeCustomerId stripeSubscriptionId');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        if (!user.stripeCustomerId) return res.json({ paymentMethod: null });

        let pmId = null;

        // 1. Try to get from the active subscription's default_payment_method
        if (user.stripeSubscriptionId) {
            try {
                const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
                    expand: ['default_payment_method']
                });
                if (sub.default_payment_method && typeof sub.default_payment_method === 'object') {
                    pmId = sub.default_payment_method;
                } else if (typeof sub.default_payment_method === 'string') {
                    pmId = sub.default_payment_method;
                }
            } catch (_) { /* subscription may not exist */ }
        }

        // 2. Fallback to customer's invoice_settings.default_payment_method
        if (!pmId) {
            const customer = await stripe.customers.retrieve(user.stripeCustomerId, {
                expand: ['invoice_settings.default_payment_method']
            });
            if (customer && !customer.deleted) {
                pmId = customer.invoice_settings?.default_payment_method || null;
            }
        }

        if (!pmId) return res.json({ paymentMethod: null });

        // Resolve string id to full object if needed
        const pm = typeof pmId === 'string'
            ? await stripe.paymentMethods.retrieve(pmId)
            : pmId;

        // Build a clean response
        const result = { type: pm.type };

        if (pm.type === 'card' && pm.card) {
            result.brand = pm.card.brand;       // visa, mastercard, amex…
            result.last4 = pm.card.last4;
            result.wallet = pm.card.wallet?.type || null; // google_pay, apple_pay, link…
        } else if (pm.type === 'paypal' && pm.paypal) {
            result.email = pm.paypal.payer_email || null;
        } else if (pm.type === 'sepa_debit' && pm.sepa_debit) {
            result.last4 = pm.sepa_debit.last4;
            result.bank = pm.sepa_debit.bank_code || null;
        } else if (pm.type === 'us_bank_account' && pm.us_bank_account) {
            result.last4 = pm.us_bank_account.last4;
            result.bank = pm.us_bank_account.bank_name || null;
        }

        return res.json({ paymentMethod: result });
    } catch (error) {
        console.error('[billing/payment-method]', error.message);
        return res.status(500).json({ message: 'Failed to retrieve payment method', error: error.message });
    }
});

export const billingWebhookHandler = async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ message: 'Stripe not configured.' });
        }
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            return res.status(503).json({ message: 'Stripe webhook secret not configured.' });
        }

        const signature = req.headers['stripe-signature'];
        if (!signature) {
            return res.status(400).send('Missing stripe-signature header');
        }

        let event;
        try {
            event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        try {
            await StripeWebhookEvent.create({
                eventId: event.id,
                eventType: event.type
            });
        } catch (err) {
            if (err?.code === 11000) {
                return res.json({ received: true, duplicate: true });
            }
            throw err;
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                await syncFromCheckoutSession(session);
                if (session.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);
                    await syncFromStripeSubscription(subscription, session.metadata?.userId || null);
                }
                break;
            }
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await syncFromStripeSubscription(subscription);
                break;
            }
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                if (invoice.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                    await syncFromStripeSubscription(subscription);
                }
                break;
            }
            case 'invoice.payment_failed': {
                // Payment failed on renewal → cancel immediately, no retries.
                const invoice = event.data.object;
                const subscriptionId = invoice.subscription;
                if (subscriptionId) {
                    try {
                        // Cancel the subscription in Stripe right away to stop retry attempts.
                        const cancelled = await stripe.subscriptions.cancel(subscriptionId);
                        console.log(`[Stripe] Subscription ${subscriptionId} cancelled immediately due to payment failure.`);
                        // Sync user to Free plan using the cancelled subscription data.
                        await syncFromStripeSubscription(cancelled);
                    } catch (cancelErr) {
                        console.error(`[Stripe] Failed to cancel subscription ${subscriptionId}:`, cancelErr.message);
                        // Fallback: find user by customerId and force free plan.
                        if (invoice.customer) {
                            const user = await User.findOne({ stripeCustomerId: invoice.customer });
                            if (user) {
                                setUserFreePlan(user);
                                user.stripeCustomerId = invoice.customer;
                                await user.save();
                                console.log(`[Stripe] Fallback: forced user ${user._id} to free plan.`);
                            }
                        }
                    }
                }
                break;
            }
            default:
                break;
        }

        return res.json({ received: true });
    } catch (error) {
        console.error('[Stripe webhook] processing failed:', error);
        return res.status(500).json({ message: 'Webhook processing failed', error: error.message });
    }
};

export default router;
