'use client';
import React from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/app/stores/authStore';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { usePrimaryAvailability } from '@/app/hooks/useAvailabiities';

import { summarizeAvailability } from './personal.utils';

const initialsFrom = (first: string, last: string): string => {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  const initials = `${a}${b}`.toUpperCase();
  return initials || '—';
};

const isHttpsAvatar = (raw?: string | null): raw is string =>
  typeof raw === 'string' && raw.trim().startsWith('https://');

const scrollToSection = (id: string) => {
  globalThis.document?.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/**
 * Compact identity card leading the Settings screen: avatar, name, an
 * "email · role · specialty" meta line, an Edit profile affordance, and a one-line
 * availability summary. All data is real (auth attributes + org membership + profile);
 * the affordances scroll to the detailed editors in the section below.
 */
const Personal = () => {
  const attributes = useAuthStore((s) => s.attributes);
  const { membership } = usePrimaryOrgWithMembership();
  const profile = usePrimaryOrgProfile();
  const { availabilities } = usePrimaryAvailability();

  if (!attributes) return null;

  const firstName = attributes.given_name ?? '';
  const lastName = attributes.family_name ?? '';
  const name = `${firstName} ${lastName}`.trim() || 'Your profile';
  const avatarUrl = profile?.personalDetails?.profilePictureUrl;

  const meta = [
    attributes.email,
    membership?.roleDisplay,
    profile?.professionalDetails?.specialization,
  ]
    .map((part) => (part ?? '').toString().trim())
    .filter((part) => part.length > 0)
    .join(' · ');

  const availabilitySummary = summarizeAvailability(availabilities);

  return (
    <div className="bg-[var(--screen)] border border-[var(--hairline)] rounded-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] px-5! py-[18px]! flex flex-col gap-[14px]">
      <div className="text-[14.5px] font-bold text-[var(--ink)]">Personal</div>
      <div className="flex items-center gap-[14px]">
        {isHttpsAvatar(avatarUrl) ? (
          <Image
            src={avatarUrl}
            alt={name}
            width={54}
            height={54}
            className="size-[54px] rounded-full object-cover flex-none"
          />
        ) : (
          <span className="flex size-[54px] flex-none items-center justify-center rounded-full bg-[var(--avatar-violet-bg)] text-[18px] font-bold text-[var(--avatar-violet-ink)]">
            {initialsFrom(firstName, lastName)}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-[14.5px] font-bold text-[var(--ink)] truncate">{name}</span>
          {meta && (
            <span className="block text-[12.5px] text-[var(--ink-muted)] truncate">{meta}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => scrollToSection('settings-user-profile')}
          className="flex h-[34px] flex-none items-center rounded-full border border-[var(--divider)] px-[15px] text-[12px] font-semibold text-[var(--ink-body)] hover:border-[var(--blue)] hover:text-[var(--blue-text)] transition-colors cursor-pointer"
        >
          Edit profile
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 pt-[6px] border-t border-[var(--hairline)]">
        <span className="text-[13px] font-semibold text-[var(--ink-body)]">
          Availability &amp; consultation hours
        </span>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--blue-text)]">
          {availabilitySummary ?? 'Not set'}
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => scrollToSection('settings-availability')}
            className="font-semibold text-[var(--blue-text)] hover:underline cursor-pointer"
          >
            edit
          </button>
        </span>
      </div>
    </div>
  );
};

export default Personal;
