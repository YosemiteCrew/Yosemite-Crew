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
    // Team column headers take the planner frame's 13px/700 --ink name type
    // (was 16px/500 muted body), on the frame's 12px vertical padding.
    <div className="grid min-w-max py-3" style={columnsStyle}>
      {team.map((user, idx) => {
        const isCurrentUser = !!currentUserId && user.practionerId === currentUserId;
        return (
          <div
            key={`${idx}-${user._id || user.practionerId || user.name}`}
            className="flex items-center justify-center flex-col"
          >
            <div
              className={`text-[13px] font-bold leading-[1.2] ${isCurrentUser ? 'text-(--color-primary-700)' : 'text-[var(--ink)]'}`}
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
