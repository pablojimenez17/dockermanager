import User from '../models/User.js';
import { PLAN_LIMITS } from '../config/plans.js';
import { STRIPE_PRICE_TO_PLAN } from '../config/stripe.js';

const FREE_PLAN = 'free';

const getPlanFromPriceId = (priceId) => STRIPE_PRICE_TO_PLAN[priceId] || FREE_PLAN;

const normalizePeriodEnd = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000) : null);

export const setUserFreePlan = (user) => {
    user.planType = FREE_PLAN;
    user.limits = PLAN_LIMITS[FREE_PLAN];
    user.autoRenew = false;
    user.pendingPlanType = null;
    user.planChangeAt = null;
    user.planExpiresAt = null;
    user.currentPeriodEnd = null;
    user.subscriptionStatus = 'canceled';
    user.stripePriceId = null;
    user.stripeSubscriptionId = null;
};

export const syncFromStripeSubscription = async (subscription, fallbackUserId = null) => {
    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    const status = subscription.status;
    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const periodEnd = normalizePeriodEnd(subscription.current_period_end);
    const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

    let user = null;
    if (customerId) {
        user = await User.findOne({ stripeCustomerId: customerId });
    }
    if (!user && fallbackUserId) {
        user = await User.findById(fallbackUserId);
    }
    if (!user) {
        return null;
    }

    user.stripeCustomerId = customerId || user.stripeCustomerId;
    user.stripeSubscriptionId = subscriptionId;
    user.stripePriceId = priceId;
    user.subscriptionStatus = status;
    user.currentPeriodEnd = periodEnd;
    user.planExpiresAt = periodEnd;
    user.autoRenew = !cancelAtPeriodEnd;

    const paidPlan = getPlanFromPriceId(priceId);
    const activeStates = new Set(['active', 'trialing', 'past_due', 'unpaid']);
    const shouldBePaid = activeStates.has(status) && paidPlan !== FREE_PLAN;

    if (shouldBePaid) {
        user.planType = paidPlan;
        user.limits = PLAN_LIMITS[paidPlan];
        user.pendingPlanType = null;
        user.planChangeAt = null;
    } else {
        setUserFreePlan(user);
        user.stripeCustomerId = customerId || user.stripeCustomerId;
        user.subscriptionStatus = status || user.subscriptionStatus;
    }

    await user.save();
    return user;
};

export const syncFromCheckoutSession = async (session) => {
    const customerId = session.customer;
    const userId = session.metadata?.userId || null;
    const subscriptionId = session.subscription || null;

    if (!userId && !customerId) {
        return null;
    }

    let user = null;
    if (userId) {
        user = await User.findById(userId);
    }
    if (!user && customerId) {
        user = await User.findOne({ stripeCustomerId: customerId });
    }
    if (!user) {
        return null;
    }

    if (customerId && !user.stripeCustomerId) {
        user.stripeCustomerId = customerId;
    }
    if (subscriptionId) {
        user.stripeSubscriptionId = subscriptionId;
    }
    await user.save();
    return user;
};
