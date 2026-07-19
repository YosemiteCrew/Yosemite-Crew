'use client';
import React, { useState } from 'react';
import clsx from 'clsx';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import { updateOrg } from '@/app/features/organization/services/orgService';
import { PreferenceRow } from './PreferenceGroup';

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
    <PreferenceRow
      label="Cross-clinic messaging"
      description="Let other verified clinics reach your team"
    >
      {isKnown ? (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Cross-clinic messaging"
          disabled={saving || !primaryOrg?._id}
          onClick={handleToggle}
          className={clsx(
            'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
            enabled ? 'bg-[var(--blue)]' : 'bg-[var(--divider)]'
          )}
        >
          <span
            className={clsx(
              'inline-block size-[18px] transform rounded-full bg-white transition-transform',
              enabled ? 'translate-x-[19px]' : 'translate-x-[3px]'
            )}
          />
        </button>
      ) : (
        <p className="shrink-0 text-right text-[11.5px] text-[var(--ink-faint)]">
          Current setting unavailable
        </p>
      )}
    </PreferenceRow>
  );
};

export default CrossClinicMessagingPreference;
