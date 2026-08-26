'use client';
import React from 'react';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
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

/**
 * One tier in the plan grid.
 *
 * Every tier is always offered; only the current one is marked and its action
 * disabled - you cannot "upgrade" to the plan you are already on. The three
 * tiers take different actions (none, Stripe checkout, a mailto), which is why
 * the button is branched per tier rather than driven by one prop.
 */
const PlanCard = ({
  plan,
  isCurrent,
  checkingOut,
  onUpgrade,
}: {
  plan: BillingPlan;
  isCurrent: boolean;
  checkingOut: boolean;
  onUpgrade: () => void;
}) => {
  /* Named rather than nested inline in the Pro button: a nested ternary trips
     Sonar's typescript:S3358, and the three states read more clearly named than
     stacked. */
  let proLabel = 'Upgrade to Pro';
  if (isCurrent) {
    proLabel = 'Current plan';
  } else if (checkingOut) {
    proLabel = 'Redirecting…';
  }

  return (
    <div
      className={[
        'DevBilling-planCard',
        isCurrent ? 'DevBilling-planCard--current' : '',
        plan.recommended && !isCurrent ? 'DevBilling-planCard--recommended' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`plan-card-${plan.key}`}
    >
      <p className="DevBilling-planName">{plan.name}</p>
      <p className="DevBilling-planPrice">{plan.price}</p>
      <p className="DevBilling-planPriceSub">{plan.priceSub}</p>
      <p className="DevBilling-planDesc">{plan.description}</p>

      <ul className="DevBilling-planFeatures">
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      {plan.key === 'free' && (
        <Secondary
          text={isCurrent ? 'Current plan' : 'Downgrade'}
          isDisabled
          style={{ maxWidth: '100%' }}
        />
      )}
      {plan.key === 'pro' && (
        <Primary
          text={proLabel}
          onClick={isCurrent ? undefined : onUpgrade}
          isDisabled={isCurrent || checkingOut}
          style={{ maxWidth: '100%' }}
        />
      )}
      {plan.key === 'enterprise' && (
        <Secondary
          text={isCurrent ? 'Current plan' : 'Contact us'}
          onClick={
            isCurrent
              ? undefined
              : () => {
                  window.location.href = 'mailto:enterprise@yosemitecrew.com';
                }
          }
          isDisabled={isCurrent}
          style={{ maxWidth: '100%' }}
        />
      )}
    </div>
  );
};

export default PlanCard;
