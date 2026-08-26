'use client';
import React from 'react';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import type { BillingPlan } from './plans';

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
