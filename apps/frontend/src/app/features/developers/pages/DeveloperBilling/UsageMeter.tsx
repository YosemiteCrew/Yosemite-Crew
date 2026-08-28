'use client';
import React from 'react';

import type { DeveloperUsage } from '@/app/services/developerUsage';

/**
 * Calls consumed in the current billing period.
 *
 * Deliberately renders only what the API returns. A plan with an included
 * allowance reports `limit`, and the meter fills against it; a metered plan
 * reports `limit: null`, and the count is shown bare. The "first 1,000 calls
 * free" the Pro card advertises is a tier on the Stripe price, not a number this
 * app owns, so it is never recomputed here into a billable-calls figure that
 * could disagree with the invoice.
 */
const UsageMeter = ({ usage }: { usage: DeveloperUsage }) => {
  const { billingPeriod, callCount, limit } = usage;
  const formatted = callCount.toLocaleString();

  /* A limit is only usable as a denominator when it is positive. `limit: 0`
     would make the fill `0 / 0` -> NaN, which reaches the DOM as the invalid
     `width: NaN%`. Anything non-positive is treated as "no allowance to show",
     the same as the null the metered plans send. */
  const allowance = limit !== null && limit > 0 ? limit : null;
  const exhausted = allowance !== null && callCount >= allowance;

  return (
    <div className="DevBilling-usage" data-testid="billing-usage">
      <div className="DevBilling-usageHead">
        <span className="DevBilling-usageLabel">API calls this period</span>
        <span className="DevBilling-usagePeriod">{billingPeriod}</span>
      </div>

      <p className="DevBilling-usageCount">
        {formatted}
        {allowance !== null && (
          <span className="DevBilling-usageLimit"> / {allowance.toLocaleString()}</span>
        )}
      </p>

      {/* A native <progress> rather than a div with role="progressbar": it carries
          the semantics for free and is announced correctly without hand-written
          aria-value* attributes (Sonar typescript:S6819). The fill is styled
          through the ::-webkit-progress-value / ::-moz-progress-bar pseudo
          elements, so no inner element is needed to draw it - which also removes
          the percentage arithmetic, since the element clamps value to max
          itself. */}
      {allowance !== null && (
        <progress
          className={`DevBilling-usageTrack${exhausted ? ' DevBilling-usageTrack--exhausted' : ''}`}
          value={Math.min(callCount, allowance)}
          max={allowance}
          aria-label="Included API calls used this period"
        />
      )}

      {exhausted && (
        <p className="DevBilling-usageWarning" role="alert">
          You have used your monthly allowance. Further API calls return 429 until the period resets
          — upgrade to Pro to keep going.
        </p>
      )}

      {allowance === null && (
        <p className="DevBilling-usageNote">
          Metered — billed at the end of the period. Test-environment calls are not counted.
        </p>
      )}
    </div>
  );
};

export default UsageMeter;
