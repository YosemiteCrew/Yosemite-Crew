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

      {allowance !== null && (
        <div
          className="DevBilling-usageTrack"
          role="progressbar"
          aria-valuenow={Math.min(callCount, allowance)}
          aria-valuemin={0}
          aria-valuemax={allowance}
          aria-label="Included API calls used this period"
        >
          <div
            className={`DevBilling-usageFill${exhausted ? ' DevBilling-usageFill--exhausted' : ''}`}
            style={{ width: `${Math.min(100, (callCount / allowance) * 100)}%` }}
          />
        </div>
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
