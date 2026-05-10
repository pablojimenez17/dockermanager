import express from 'express';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import StripeWebhookEvent from '../models/StripeWebhookEvent.js';
import { isValidPlanType, PAID_PLAN_TYPES } from '../config/plans.js';
import { PLAN_TO_STRIPE_PRICE, stripe, stripeReady } from '../config/stripe.js';
import { syncFromCheckoutSession, syncFromStripeSubscription } from '../services/subscriptionSyncService.js';

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
            case 'invoice.payment_succeeded':
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                if (invoice.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                    await syncFromStripeSubscription(subscription);
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
