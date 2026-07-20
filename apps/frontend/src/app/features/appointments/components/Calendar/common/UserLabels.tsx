import Image from 'next/image';
import { Team } from '@/app/features/organization/types/team';
import { useAuthStore } from '@/app/stores/authStore';
import React from 'react';

type UserLabels = {
  team: Team[];
  columnsStyle?: React.CSSProperties;
};

/** Warm avatar palettes rotated across the team so each column keeps a stable colour. */
const AVATAR_PALETTES = [
  { background: 'var(--avatar-violet-bg)', color: 'var(--avatar-violet-ink)' },
  { background: 'var(--avatar-green-bg)', color: 'var(--avatar-green-ink)' },
  { background: 'var(--avatar-amber-bg)', color: 'var(--avatar-amber-ink)' },
];

/** Up to two initials for the avatar chip ("Dr. Sarah Weber" → "SW"). */
const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((part) => /[a-z]/i.test(part[0] ?? ''))
    .slice(-2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

/** "Small animals · 5 today" — speciality and today's booked count, whichever exist. */
const subline = (user: Team): string =>
  [user.speciality?.[0]?.name, user.todayAppointment ? `${user.todayAppointment} today` : undefined]
    .filter(Boolean)
    .join(' · ');

const UserLabels = ({ team, columnsStyle }: UserLabels) => {
  const { attributes } = useAuthStore();
  const currentUserId = attributes?.sub || attributes?.email;

  return (
    // Team column headers take the planner frame's 30px avatar + 13px/700 --ink
    // name + 11px --ink-faint speciality/count subline, on 12px vertical padding.
    <div className="grid min-w-max py-3" style={columnsStyle}>
      {team.map((user, idx) => {
        const isCurrentUser = !!currentUserId && user.practionerId === currentUserId;
        const name = user.name || '';
        const meta = subline(user);
        return (
          <div
            key={user._id || user.practionerId || name}
            className="flex items-center justify-center gap-2 px-2"
          >
            {user.image ? (
              <Image
                src={user.image}
                alt={name}
                width={30}
                height={30}
                className="size-[30px] shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={AVATAR_PALETTES[idx % AVATAR_PALETTES.length]}
              >
                {initialsOf(name)}
              </span>
            )}
            <div className="min-w-0">
              <div
                className={`truncate text-[13px] font-bold leading-[1.2] ${isCurrentUser ? 'text-(--color-primary-700)' : 'text-[var(--ink)]'}`}
              >
                {name}
              </div>
              {meta && (
                <div
                  className="truncate text-[11px] leading-[1.3]"
                  style={{ color: 'var(--ink-faint)' }}
                >
                  {meta}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserLabels;
