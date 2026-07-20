'use client';
import React from 'react';
import Link from 'next/link';
import { IoAdd } from 'react-icons/io5';
import { useOrgWithMemberships } from '@/app/hooks/useOrgSelectors';
import { useOrgStore } from '@/app/stores/orgStore';
import '@/app/features/settings/styles/Settings.css';

// Avatar palette for the non-primary organizations, mirroring the design's
// rotating violet/green/amber tokens. The primary org always uses the blue tile.
const AVATAR_PALETTE: ReadonlyArray<{ bg: string; ink: string }> = [
  { bg: 'var(--avatar-green-bg)', ink: 'var(--avatar-green-ink)' },
  { bg: 'var(--avatar-violet-bg)', ink: 'var(--avatar-violet-ink)' },
  { bg: 'var(--avatar-amber-bg)', ink: 'var(--avatar-amber-ink)' },
];

const initialFrom = (name?: string): string => {
  const first = (name ?? '').trim().charAt(0);
  return first ? first.toUpperCase() : '—';
};

/**
 * "Your organizations" card from the Settings design: every org the user belongs
 * to, its role and whether it is primary. The primary org carries a PRIMARY badge;
 * the others expose a "Switch" affordance that repoints the primary org (the same
 * `setPrimaryOrg` the header switcher uses). Real data from the org store.
 */
const YourOrganizations = () => {
  const orgs = useOrgWithMemberships();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const setPrimaryOrg = useOrgStore((s) => s.setPrimaryOrg);

  if (orgs.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5! py-[18px]! shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-[14.5px] font-bold text-[var(--ink)]">Your organizations</h3>
        <Link href="/create-org" className="yc-settings-card-action">
          <IoAdd size={13} aria-hidden="true" />
          New organization
        </Link>
      </div>
      {orgs.map(({ org, membership }, index) => {
        const orgId = String(org._id ?? org.name);
        const isPrimary = primaryOrgId != null && orgId === primaryOrgId;
        const role = (membership?.roleDisplay ?? '').toString().trim() || 'Member';
        const palette = isPrimary
          ? { bg: 'var(--blue-soft)', ink: 'var(--blue-text)' }
          : AVATAR_PALETTE[index % AVATAR_PALETTE.length];
        return (
          <div key={orgId} className="flex items-center gap-[11px]">
            <span
              className="flex size-[34px] flex-none items-center justify-center rounded-[10px] text-[13px] font-bold"
              style={{ background: palette.bg, color: palette.ink }}
            >
              {initialFrom(org.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-[var(--ink)]">
                {org.name}
              </span>
              <span className="block truncate text-[11.5px] text-[var(--ink-faint)]">
                {role} · {isPrimary ? 'primary' : 'secondary'}
              </span>
            </span>
            {isPrimary ? (
              <span className="inline-flex flex-none items-center rounded-full border border-[var(--status-completed-border)] bg-[var(--status-completed-bg)] px-[9px] py-0.5 text-[9.5px] font-bold text-[var(--status-completed-text)]">
                PRIMARY
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPrimaryOrg(orgId)}
                className="flex-none cursor-pointer text-[12px] font-semibold text-[var(--blue-text)] hover:underline"
              >
                Switch
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default YourOrganizations;
