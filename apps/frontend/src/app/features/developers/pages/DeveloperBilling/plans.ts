import type { DeveloperPlanTier } from '@/app/services/developerBilling';

export interface BillingPlan {
  key: DeveloperPlanTier;
  name: string;
  price: string;
  priceSub: string;
  description: string;
  features: string[];
  recommended: boolean;
}

/**
 * Marketing copy for the three tiers. Lives beside the card that renders it
 * rather than on the page, since nothing else reads it.
 *
 * The per-call rate and the included allowance are copy, not configuration - the
 * real numbers are the Stripe price's tiers. Keep them in step by hand.
 */
export const PLANS: BillingPlan[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    priceSub: 'forever',
    description: 'Explore the API and build your first integration.',
    features: [
      '1,000 API calls / month',
      '1 API key',
      'Test environment access',
      'Community support',
    ],
    recommended: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'Pay as you go',
    priceSub: 'metered · billed monthly',
    description: 'Scales with your usage — pay only for what you consume.',
    features: [
      '~$0.002 per API call',
      'First 1,000 calls free each month',
      'Unlimited API keys',
      'Live + test environments',
      'Webhook support',
      'Priority support',
    ],
    recommended: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    priceSub: 'volume discounts available',
    description: 'For platforms and large teams with predictable high-volume needs.',
    features: [
      'Custom per-call rate',
      'Unlimited API keys',
      'Dedicated support',
      'Custom SLA',
      'Usage analytics dashboard',
    ],
    recommended: false,
  },
];
