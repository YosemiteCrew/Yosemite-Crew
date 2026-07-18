'use client';
import React, { useState } from 'react';
import clsx from 'clsx';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import { updateOrg } from '@/app/features/organization/services/orgService';

/**
 * Org-level gate for cross-clinic (network) colleague messaging. Off by default;
 * when a business owner enables it, the clinic's staff can be discovered by — and
 * start conversations with — colleagues at other clinics on the network, and vice
 * versa. Both clinics must have it enabled for a conversation to start. Turning it
 * off removes the clinic from the cross-clinic directory.
 */
const CrossClinicMessagingPreference = () => {
  const { notify } = useNotify();
  const primaryOrg = useOrgStore((s) => s.getPrimaryOrg());
  const stored = primaryOrg?.crossOrgMessagingEnabled;
  // The org-list load path omits this field, so `undefined` means "not loaded" — NOT "off".
  // Coercing it to off would tell a clinic that has this on that it is undiscoverable, and
  // make the first click re-send the state it already had instead of turning it off.
  const isKnown = typeof stored === 'boolean';
  const enabled = stored === true;
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    if (!primaryOrg?._id || saving || !isKnown) return;
    const next = !enabled;
    setSaving(true);
    try {
      await updateOrg({ ...primaryOrg, crossOrgMessagingEnabled: next });
      notify('success', {
        title: next ? 'Cross-clinic messaging enabled' : 'Cross-clinic messaging disabled',
        text: next
          ? 'Your staff can now message, and be messaged by, colleagues at other clinics.'
          : 'Your clinic is no longer discoverable for cross-clinic messaging.',
      });
    } catch {
      notify('error', {
        title: 'Unable to update cross-clinic messaging',
        text: 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--screen)] border border-[var(--hairline)] rounded-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
      <div className="px-5! pt-4! pb-3! border-b border-[var(--hairline)] flex items-center justify-between">
        <div className="text-[16px] font-bold tracking-[-0.01em] text-[var(--ink)]">
          Cross-clinic messaging
        </div>
      </div>
      <div className="flex items-start justify-between gap-4 px-5! py-5!">
        <p className="max-w-[70%] text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
          Let your staff message colleagues at other clinics on the network, and be discoverable to
          them. Both clinics must enable this for a conversation to start. Off by default.
        </p>
        {isKnown ? (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Cross-clinic messaging"
            disabled={saving || !primaryOrg?._id}
            onClick={handleToggle}
            className={clsx(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
              enabled ? 'bg-primary-600' : 'bg-neutral-300'
            )}
          >
            <span
              className={clsx(
                'inline-block h-5 w-5 transform rounded-full bg-neutral-0 transition-transform',
                enabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
        ) : (
          <p className="text-body-4 text-text-secondary shrink-0 text-right">
            Current setting unavailable
          </p>
        )}
      </div>
    </div>
  );
};

export default CrossClinicMessagingPreference;
