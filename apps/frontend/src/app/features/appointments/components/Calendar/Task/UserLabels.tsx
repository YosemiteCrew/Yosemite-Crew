import { Team } from '@/app/features/organization/types/team';
import { useAuthStore } from '@/app/stores/authStore';
import React from 'react';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';

type UserLabels = {
  team: Team[];
  currentDate: Date;
  columnsStyle?: React.CSSProperties;
};

const UserLabels = ({ team, currentDate, columnsStyle }: UserLabels) => {
  const { attributes } = useAuthStore();
  const currentUserId = attributes?.sub || attributes?.email;

  return (
    <div className="grid min-w-max border-b border-grey-light py-3" style={columnsStyle}>
      {team.map((user, idx) => {
        const isCurrentUser = !!currentUserId && user.practionerId === currentUserId;
        const weekday = formatDateInPreferredTimeZone(currentDate, {
          weekday: 'short',
        });
        const dateNumber = formatDateInPreferredTimeZone(currentDate, {
          day: 'numeric',
        });
        return (
          <div
            key={idx + currentDate.getDate()}
            className="flex items-center justify-center flex-col"
          >
            <div
              className={`text-body-3 ${isCurrentUser ? 'text-text-brand' : 'text-text-secondary'}`}
            >
              {user.name || ''}
            </div>
            <div className="text-body-4 text-text-brand">{weekday}</div>
            <div className="text-body-4-emphasis text-white h-10 w-10 flex items-center justify-center rounded-full bg-text-brand">
              {dateNumber}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserLabels;
