'use client';
import React, { useEffect, useMemo, useState } from 'react';
import AvailabilityTable from '@/app/ui/tables/AvailabilityTable';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Team as TeamProp } from '@/app/features/organization/types/team';

import './Summary.css';
import TeamInfo from '@/app/features/organization/pages/Organization/Sections/Team/TeamInfo';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';

const AvailabilityLabels = [
  {
    name: 'All',
    value: 'all',
    background: 'color-mix(in srgb, var(--color-neutral-800) 10%, transparent)',
    color: 'var(--color-neutral-900)',
    border: 'var(--color-neutral-400)',
  },
  {
    name: 'Available',
    value: 'available',
    background: 'var(--color-success-100)',
    color: 'var(--color-success-400)',
    border: 'var(--color-pill-success-border)',
  },
  {
    name: 'Consulting',
    value: 'consulting',
    background: 'var(--color-pill-progress-bg)',
    color: 'var(--color-pill-progress-text)',
    border: 'var(--color-pill-progress-border)',
  },
  {
    name: 'Requested',
    value: 'requested',
    background: 'var(--color-neutral-100)',
    color: 'var(--color-neutral-900)',
    border: 'var(--color-pill-neutral-border)',
  },
  {
    name: 'Off-Duty',
    value: 'off-duty',
    background: 'var(--color-card-warning)',
    color: 'var(--color-warning-600)',
    border: 'var(--color-warning-600)',
  },
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
        <div className="text-text-primary text-heading-1">
          Availability <span className="text-text-tertiary">({teams.length})</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {AvailabilityLabels?.map((label, i) => {
            const isActive = label.value === selectedLabel;
            return (
              <button
                key={label.name + i}
                className={`min-w-20 text-body-4 px-3 py-1.5 rounded-2xl! border! transition-all duration-300 hover:bg-card-hover text-text-tertiary${isActive ? '' : ' border-card-border! hover:border-card-hover!'}`}
                style={
                  isActive
                    ? {
                        background: label.background,
                        color: label.color,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: label.border,
                      }
                    : undefined
                }
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
