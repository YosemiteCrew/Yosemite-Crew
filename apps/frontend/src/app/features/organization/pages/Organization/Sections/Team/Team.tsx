import AccordionButton from '@/app/ui/primitives/Accordion/AccordionButton';
import AvailabilityTable from '@/app/ui/tables/AvailabilityTable';
import React, { useEffect, useRef, useState } from 'react';
import AddTeam from '@/app/features/organization/pages/Organization/Sections/Team/AddTeam';
import TeamInfo from '@/app/features/organization/pages/Organization/Sections/Team/TeamInfo';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Team as TeamProp } from '@/app/features/organization/types/team';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { formatDateInPreferredTimeZone, getPreferredTimeZone } from '@/app/lib/timezone';

const Team = () => {
  const teams = useTeamForPrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const availabilityIdsByOrgId = useAvailabilityStore((s) => s.availabilityIdsByOrgId);
  const availabilitiesById = useAvailabilityStore((s) => s.availabilitiesById);
  const { can } = usePermissions();
  const canEditTeam = can(PERMISSIONS.TEAMS_EDIT_ANY);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const lastAvailabilityDebugKeyRef = useRef<string>('');
  const [activeTeam, setActiveTeam] = useState<TeamProp | null>(teams[0] ?? null);

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

  useEffect(() => {
    if (!primaryOrgId) return;
    const dayKey = formatDateInPreferredTimeZone(new Date(), { weekday: 'long' }).toUpperCase();
    const ids = availabilityIdsByOrgId[primaryOrgId] ?? [];
    const rowsForDay = ids
      .map((id) => availabilitiesById[id])
      .filter((item) => item?.dayOfWeek === dayKey);

    const teamAvailability = teams.map((member) => {
      const idSet = new Set(
        [
          member.practionerId,
          member._id,
          (member as any).userId,
          (member as any).id,
          (member as any).userOrganisation?.userId,
        ]
          .filter(Boolean)
          .map(
            (value) =>
              String(value ?? '')
                .trim()
                .split('/')
                .pop()
                ?.toLowerCase() ?? ''
          )
      );
      const matched = rowsForDay.filter((row) =>
        idSet.has(
          String(row.userId ?? '')
            .trim()
            .split('/')
            .pop()
            ?.toLowerCase() ?? ''
        )
      );
      return {
        name: member.name,
        currentStatusFromTeamApi: member.status,
        ids: {
          practionerId: member.practionerId,
          _id: member._id,
          userId: (member as any).userId,
          id: (member as any).id,
        },
        availabilityRows: matched.map((row) => ({
          _id: row._id,
          userId: row.userId,
          dayOfWeek: row.dayOfWeek,
          slots: row.slots,
        })),
      };
    });

    const payload = {
      preferredTimeZone: getPreferredTimeZone(),
      dayOfWeekKey: dayKey,
      rawOrgRowsForDay: rowsForDay,
      teamAvailability,
    };
    const logKey = `${dayKey}:${JSON.stringify(payload)}`;
    if (lastAvailabilityDebugKeyRef.current !== logKey) {
      lastAvailabilityDebugKeyRef.current = logKey;
      console.log('[Team][AvailabilityDebug]', payload);
    }
  }, [primaryOrgId, availabilityIdsByOrgId, availabilitiesById, teams]);

  return (
    <PermissionGate allOf={[PERMISSIONS.TEAMS_VIEW_ANY]}>
      <AccordionButton
        title="Team"
        buttonTitle="Add"
        buttonClick={setAddPopup}
        showButton={canEditTeam}
      >
        <AvailabilityTable filteredList={teams} setActive={setActiveTeam} setView={setViewPopup} />
      </AccordionButton>
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
