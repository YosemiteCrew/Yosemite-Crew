import { Team } from '@/app/features/organization/types/team';
import { useAuthStore } from '@/app/stores/authStore';
import React from 'react';

type UserLabels = {
  team: Team[];
  columnsStyle?: React.CSSProperties;
};

const UserLabels = ({ team, columnsStyle }: UserLabels) => {
  const { attributes } = useAuthStore();
  const currentUserId = attributes?.sub || attributes?.email;

  return (
    <div className="grid min-w-max py-1" style={columnsStyle}>
      {team.map((user, idx) => {
        const isCurrentUser = !!currentUserId && user.practionerId === currentUserId;
        return (
          <div
            key={`${idx}-${user._id || user.practionerId || user.name}`}
            className="flex items-center justify-center flex-col"
          >
            <div
              className={`text-body-3 ${isCurrentUser ? 'text-text-brand' : 'text-text-secondary'}`}
            >
              {user.name || ''}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserLabels;
