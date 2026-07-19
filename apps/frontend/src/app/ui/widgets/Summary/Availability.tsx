'use client';
import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import AvailabilityTable from '@/app/ui/tables/AvailabilityTable';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Team as TeamProp } from '@/app/features/organization/types/team';

import './Summary.css';
import TeamInfo from '@/app/features/organization/pages/Organization/Sections/Team/TeamInfo';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';

const AvailabilityLabels = [
  { name: 'All', value: 'all' },
  { name: 'Available', value: 'available' },
  { name: 'Consulting', value: 'consulting' },
  { name: 'Requested', value: 'requested' },
  { name: 'Off-duty', value: 'off-duty' },
];

const Availability = () => {
  const teams = useTeamForPrimaryOrg();
  const { can } = usePermissions();
  const canEditTeam = can(PERMISSIONS.TEAMS_EDIT_ANY);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTeam, setActiveTeam] = useState<TeamProp | null>(teams[0] ?? null);
  const [selectedLabel, setSelectedLabel] = useState('all');

  const filteredList = useMemo(() => {
    return teams.filter((item) => {
      const matchesStatus =
        selectedLabel === 'all' || item.status.toLowerCase() === selectedLabel.toLowerCase();
      return matchesStatus;
    });
  }, [teams, selectedLabel]);

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
      <div className="summary-container">
        <h2 className="text-[16px] font-bold tracking-[-0.02em] text-[var(--ink)]">
          Availability <span className="font-medium text-[var(--ink-faint)]">({teams.length})</span>
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {AvailabilityLabels?.map((label) => {
            const isActive = label.value === selectedLabel;
            return (
              <button
                type="button"
                key={label.value}
                className={clsx(
                  'rounded-full! border px-[13px] py-1.5 text-[12px] transition-colors',
                  isActive
                    ? 'border-[var(--divider)] bg-[var(--inset)] font-bold text-[var(--ink)]'
                    : 'border-[var(--hairline)] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]'
                )}
                onClick={() => setSelectedLabel(label.value)}
              >
                {label.name}
              </button>
            );
          })}
        </div>
        <AvailabilityTable
          filteredList={filteredList}
          setActive={setActiveTeam}
          setView={setViewPopup}
        />
        {activeTeam && (
          <TeamInfo
            showModal={viewPopup}
            setShowModal={setViewPopup}
            activeTeam={activeTeam}
            canEditTeam={canEditTeam}
          />
        )}
      </div>
    </PermissionGate>
  );
};

export default Availability;
