import Stripe from 'stripe';

const requiredEnv = ['STRIPE_SECRET_KEY'];
for (const key of requiredEnv) {
    if (!process.env[key]) {
        console.warn(`[Stripe] Missing environment variable: ${key}`);
    }
}

export const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
    : null;

export const STRIPE_PRICE_TO_PLAN = {
    [process.env.STRIPE_PRICE_PRO_MONTHLY]: 'pro',
    [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY]: 'enterprise',
    [process.env.STRIPE_PRICE_AGENCY_MONTHLY]: 'agency'
};

export const PLAN_TO_STRIPE_PRICE = {
    pro: process.env.STRIPE_PRICE_PRO_MONTHLY,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    agency: process.env.STRIPE_PRICE_AGENCY_MONTHLY
};

export const stripeReady = Boolean(
    stripe &&
    process.env.STRIPE_PRICE_PRO_MONTHLY &&
    process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY &&
    process.env.STRIPE_PRICE_AGENCY_MONTHLY
);
