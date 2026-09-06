import React, { useState } from 'react';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import { IoEllipsisHorizontal, IoPersonAddOutline } from 'react-icons/io5';
import AddTeam from '@/app/features/organization/pages/Organization/Sections/Team/AddTeam';
import TeamInfo from '@/app/features/organization/pages/Organization/Sections/Team/TeamInfo';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Team as TeamProp } from '@/app/features/organization/types/team';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';
import { getSafeImageUrl } from '@/app/lib/urls';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  avatarAccentFor,
  humanize,
  initialsOf,
  teamStatusPill,
} from '@/app/features/organization/pages/Organization/Sections/orgDisplay';
import '@/app/ui/tables/GenericTable/Generictable.css';

const GRID_COLS = 'grid-cols-[1.6fr_1fr_1fr_110px_44px]';

const specialityLabel = (team: TeamProp): string => {
  if (!Array.isArray(team.speciality) || team.speciality.length === 0) return '';
  return team.speciality
    .flatMap((spec) => {
      const name = typeof spec === 'string' ? spec : (spec?.name ?? '');
      return name ? [name] : [];
    })
    .join(', ');
};

const employmentLabel = (team: TeamProp): string => {
  const value = (team as { employmentType?: string }).employmentType;
  return value ? humanize(value) : '—';
};

const TeamAvatar = ({ team }: { team: TeamProp }) => {
  const initials = (
    <span
      className={`flex size-[30px] flex-none items-center justify-center rounded-full text-[10.5px] font-bold ${avatarAccentFor(team._id || team.name || '')}`}
    >
      {initialsOf(team.name)}
    </span>
  );
  if (!team.image) return initials;
  // A photo whose URL stopped resolving degrades to the same initials disc,
  // never an empty circle.
  return (
    <AvatarImage
      src={getSafeImageUrl(team.image, 'person')}
      alt=""
      size={30}
      className="size-[30px] flex-none rounded-full object-cover"
      fallback={initials}
    />
  );
};

const TeamRow = ({ team, onOpen }: { team: TeamProp; onOpen: (team: TeamProp) => void }) => {
  const subline = specialityLabel(team);
  const pill = teamStatusPill(team.status);
  return (
    <div
      className={`grid ${GRID_COLS} items-center gap-[10px] border-t border-[var(--hairline)] px-5! py-[10px]! text-[13px] text-[var(--ink-body)]`}
    >
      <span className="flex min-w-0 items-center gap-[9px]">
        <TeamAvatar team={team} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold text-[var(--ink)]">
            {team.name || 'Team member'}
          </span>
          {subline && (
            <span className="block truncate text-[11px] text-[var(--ink-faint)]">{subline}</span>
          )}
        </span>
      </span>
      <span className="truncate text-[var(--ink-muted)]">{humanize(team.role) || '—'}</span>
      <span className="truncate text-[var(--ink-muted)]">{employmentLabel(team)}</span>
      <span>
        <StatusPill label={pill.label} tokens={pill.tokens} />
      </span>
      <span className="flex justify-center">
        <button
          type="button"
          aria-label={`Open ${team.name || 'team member'} details`}
          onClick={() => onOpen(team)}
          className="flex size-7 items-center justify-center rounded-full text-[var(--ink-faint)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] transition-colors cursor-pointer"
        >
          <IoEllipsisHorizontal size={15} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
};

const Team = ({ isVerified = false }: { isVerified?: boolean }) => {
  const teams = useTeamForPrimaryOrg();
  const { can } = usePermissions();
  const canEditTeam = can(PERMISSIONS.TEAMS_EDIT_ANY);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTeam, setActiveTeam] = useState<TeamProp | null>(teams[0] ?? null);
  const showInvite = canEditTeam && isVerified;

  // Re-point the selection when the team list changes (adjusted during
  // render, per React's "adjusting state when a prop changes" pattern).
  const [prevTeams, setPrevTeams] = useState(teams);
  if (prevTeams !== teams) {
    setPrevTeams(teams);
    setActiveTeam((prev) => {
      if (teams.length === 0) return null;
      if (prev?._id) {
        const updated = teams.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return teams[0];
    });
  }

  const handleOpen = (team: TeamProp) => {
    setActiveTeam(team);
    setViewPopup(true);
  };

  return (
    <PermissionGate
      allOf={[PERMISSIONS.TEAMS_VIEW_ANY]}
      fallback={<Fallback resource="the team roster" />}
    >
      <section className="flex flex-col overflow-hidden yc-card-surface">
        <div className="flex items-center justify-between gap-3 px-5! pt-4! pb-3!">
          {/* Section heading: `text-heading-3` (20px/500), the same ramp SectionCard
              gives Specialities, Documents, Online booking and Booking requests
              further down this page. This was hand-rolled at 15.5px/700, so
              scrolling Organization swung the section title between two type
              ramps. The count keeps only its faint colour - a weight of its own
              would out-bold the title under the mobile heading-3 override. */}
          <h2 className="text-heading-3 text-text-primary">
            Team <span className="text-[var(--ink-faint)]">({teams.length})</span>
          </h2>
          {showInvite && (
            <button
              type="button"
              onClick={() => setAddPopup(true)}
              className="inline-flex h-[34px] items-center gap-[6px] rounded-full bg-[var(--cta)] px-[15px]! text-[12px] font-semibold text-[var(--cta-text)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <IoPersonAddOutline size={13} aria-hidden="true" />
              Invite member
            </button>
          )}
        </div>
        <div
          className={`grid ${GRID_COLS} items-center gap-[10px] yc-table-head border-t border-[var(--hairline)]`}
        >
          <span>Member</span>
          <span>Role</span>
          <span>Employment</span>
          <span>Status</span>
          <span aria-hidden="true" />
        </div>
        {teams.length === 0 ? (
          <div className="border-t border-[var(--hairline)] px-5! py-[18px]! text-[12.5px] text-[var(--ink-faint)]">
            No team members yet.
          </div>
        ) : (
          teams.map((team) => <TeamRow key={team._id} team={team} onOpen={handleOpen} />)
        )}
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
