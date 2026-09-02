'use client';
import React from 'react';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import { IoTimeOutline } from 'react-icons/io5';
import { useAuthStore } from '@/app/stores/authStore';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { usePrimaryAvailability } from '@/app/hooks/useAvailabiities';

import { summarizeAvailability } from './personal.utils';
import '@/app/features/settings/styles/Settings.css';

const initialsFrom = (first: string, last: string): string => {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  const initials = `${a}${b}`.toUpperCase();
  return initials || '—';
};

const isHttpsAvatar = (raw?: string | null): raw is string =>
  typeof raw === 'string' && raw.trim().startsWith('https://');

type PersonalProps = {
  onEditProfile?: () => void;
  onEditHours?: () => void;
};

/**
 * Compact identity card leading the Settings screen: avatar, name, an
 * "email · role · specialty" meta line, an Edit profile affordance, and a one-line
 * availability summary. All data is real (auth attributes + org membership + profile);
 * the affordances open the profile and availability editors as modals.
 */
const Personal = ({ onEditProfile, onEditHours }: PersonalProps) => {
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
  const initialsDisc = (
    <span className="flex size-[54px] flex-none items-center justify-center rounded-full bg-[var(--avatar-violet-bg)] text-[18px] font-bold text-[var(--avatar-violet-ink)]">
      {initialsFrom(firstName, lastName)}
    </span>
  );

  return (
    <div className="bg-[var(--screen)] border border-[var(--hairline)] rounded-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] px-5! py-[18px]! flex flex-col gap-[14px]">
      <div className="text-[14.5px] font-bold text-[var(--ink)]">Personal</div>
      <div className="flex items-center gap-[14px]">
        {isHttpsAvatar(avatarUrl) ? (
          <AvatarImage
            src={avatarUrl}
            alt={name}
            size={54}
            className="size-[54px] rounded-full object-cover flex-none"
            fallback={initialsDisc}
          />
        ) : (
          initialsDisc
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-[14.5px] font-bold text-[var(--ink)] truncate">{name}</span>
          {meta && (
            <span className="block text-[12.5px] text-[var(--ink-muted)] truncate">{meta}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onEditProfile}
          className="flex h-[34px] flex-none items-center rounded-full border border-[var(--divider)] px-[15px] text-[12px] font-semibold text-[var(--ink-body)] hover:border-[var(--blue)] hover:text-[var(--blue-text)] transition-colors cursor-pointer"
        >
          Edit profile
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 pt-[12px] border-t border-[var(--hairline)]">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-[var(--ink-body)]">
            Availability &amp; consultation hours
          </span>
          <span className="block truncate text-[11.5px] text-[var(--ink-faint)]">
            {availabilitySummary ?? 'Not set'}
          </span>
        </span>
        <button type="button" onClick={onEditHours} className="yc-settings-ghost-pill">
          <IoTimeOutline size={13} aria-hidden="true" className="yc-settings-ghost-pill-icon" />
          Edit hours
        </button>
      </div>
    </div>
  );
};

export default Personal;
