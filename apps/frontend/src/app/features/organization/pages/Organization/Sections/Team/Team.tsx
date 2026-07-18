import AvailabilityTable from '@/app/ui/tables/AvailabilityTable';
import React, { useEffect, useState } from 'react';
import { IoPersonAddOutline } from 'react-icons/io5';
import AddTeam from '@/app/features/organization/pages/Organization/Sections/Team/AddTeam';
import TeamInfo from '@/app/features/organization/pages/Organization/Sections/Team/TeamInfo';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Team as TeamProp } from '@/app/features/organization/types/team';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';

const Team = ({ isVerified = false }: { isVerified?: boolean }) => {
  const teams = useTeamForPrimaryOrg();
  const { can } = usePermissions();
  const canEditTeam = can(PERMISSIONS.TEAMS_EDIT_ANY);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTeam, setActiveTeam] = useState<TeamProp | null>(teams[0] ?? null);
  const showInvite = canEditTeam && isVerified;

  useEffect(() => {
    setActiveTeam((prev) => {
      if (teams.length === 0) return null;
      if (prev?._id) {
        const updated = teams.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return teams[0];
    });
  }, [teams]);

  return (
    <PermissionGate allOf={[PERMISSIONS.TEAMS_VIEW_ANY]}>
      <section className="bg-[var(--screen)] border border-[var(--hairline)] rounded-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5! pt-4! pb-3!">
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--ink)]">
            Team <span className="font-medium text-[var(--ink-faint)]">({teams.length})</span>
          </h2>
          {showInvite && (
            <button
              type="button"
              onClick={() => setAddPopup(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[var(--cta)] text-[var(--cta-text)] text-[12px] font-semibold hover:bg-[var(--cta-hover)] transition-colors cursor-pointer"
            >
              <IoPersonAddOutline size={14} aria-hidden="true" />
              Invite member
            </button>
          )}
        </div>
        <div className="border-t border-[var(--hairline)]">
          <AvailabilityTable
            filteredList={teams}
            setActive={setActiveTeam}
            setView={setViewPopup}
          />
        </div>
      </section>
      <AddTeam showModal={addPopup} setShowModal={setAddPopup} />
      {activeTeam && (
        <TeamInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeTeam={activeTeam}
          canEditTeam={canEditTeam}
        />
      )}
    </PermissionGate>
  );
};

export default Team;
