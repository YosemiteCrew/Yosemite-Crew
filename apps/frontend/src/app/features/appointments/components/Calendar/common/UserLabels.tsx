import { Team } from '@/app/features/organization/types/team';
import { useAuthStore } from '@/app/stores/authStore';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';
import clsx from 'clsx';
import React from 'react';

type UserLabelsProps = {
  team: Team[];
  columnsStyle?: React.CSSProperties;
  appointmentCounts?: Record<string, number>;
};

const humanizeRole = (role: string): string =>
  role
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const UserLabels = ({ team, columnsStyle, appointmentCounts }: UserLabelsProps) => {
  const { attributes } = useAuthStore();
  const currentUserId = attributes?.sub || attributes?.email;
  const showDetails = appointmentCounts !== undefined;

  return (
    <div className="grid min-w-max py-2" style={columnsStyle}>
      {team.map((user) => {
        const isCurrentUser = !!currentUserId && user.practionerId === currentUserId;
        const name = user.name || '';
        const key = user._id || user.practionerId || name;

        if (!showDetails) {
          return (
            <div key={key} className="flex items-center justify-center flex-col">
              <div
                className={clsx(
                  'text-body-4 font-medium',
                  isCurrentUser ? 'text-(--color-primary-700)' : 'text-text-secondary'
                )}
              >
                {name}
              </div>
            </div>
          );
        }

        const specialityLabel = user.speciality[0]?.name.trim() || humanizeRole(user.role);
        const count = appointmentCounts[user.practionerId || user._id] ?? 0;

        return (
          <div key={key} className="flex flex-col items-center gap-1 px-2 min-w-0 text-center">
            <AppointmentAvatar name={name} photoUrl={user.image} size={28} />
            <div className="w-full min-w-0">
              <div
                className={clsx(
                  'text-caption-1 truncate',
                  isCurrentUser ? 'text-(--color-primary-700)' : 'text-text-primary'
                )}
              >
                {name}
              </div>
              <div className="text-caption-2 text-text-secondary truncate">{specialityLabel}</div>
            </div>
            <span className="inline-flex items-center rounded-full bg-card-bg px-2 py-0.5 text-caption-2 text-text-secondary whitespace-nowrap">
              {count} today
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default UserLabels;
