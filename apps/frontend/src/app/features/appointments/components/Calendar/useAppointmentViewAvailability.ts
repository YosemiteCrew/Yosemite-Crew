import { useCallback, useEffect, useRef } from 'react';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useLoadAvailabilities } from '@/app/hooks/useAvailabiities';
import { useOrgStore } from '@/app/stores/orgStore';
import { loadTeamAvailability } from '@/app/features/organization/services/availabilityService';
import {
  DropAvailabilityInterval,
  resolveAvailabilityIntervalsForDay,
} from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { getDayOfWeekKey } from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';
import {
  findTeamMemberByIdentity,
  getTeamMemberIdentityIds,
} from '@/app/features/appointments/components/Calendar/appointmentDragAvailabilityUtils';
import { utcClockTimeToPreferredTimeZoneClock } from '@/app/lib/timezone';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

type UseAppointmentViewAvailabilityOptions = {
  activeCalendar: string;
  normalizeId: (value?: string) => string;
  teams: ReturnType<typeof useTeamForPrimaryOrg>;
};

export const useAppointmentViewAvailability = ({
  activeCalendar,
  normalizeId,
  teams,
}: UseAppointmentViewAvailabilityOptions) => {
  const teamAvailabilityFetchedRef = useRef<string | null>(null);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const availabilityIdsByOrgId = useAvailabilityStore((s) => s.availabilityIdsByOrgId);
  const availabilitiesById = useAvailabilityStore((s) => s.availabilitiesById);
  const availabilityStatus = useAvailabilityStore((s) => s.status);
  const availabilityLoaded = availabilityStatus === 'loaded';
  useLoadAvailabilities();

  useEffect(() => {
    if (activeCalendar !== 'team' || !primaryOrgId) return;
    if (teamAvailabilityFetchedRef.current === primaryOrgId) return;
    teamAvailabilityFetchedRef.current = primaryOrgId;
    loadTeamAvailability(primaryOrgId).catch(() => {
      teamAvailabilityFetchedRef.current = null;
    });
  }, [activeCalendar, primaryOrgId]);

  const getViewAvailabilityIntervals = useCallback(
    (date: Date, targetLeadId?: string): DropAvailabilityInterval[] => {
      if (!primaryOrgId) return [];
      const ids = availabilityIdsByOrgId[primaryOrgId] ?? [];
      const orgAvailabilities = ids.flatMap((id) => {
        const availability = availabilitiesById[id];
        return availability ? [availability] : [];
      });
      if (!orgAvailabilities.length) return [];

      const normalizedTarget = normalizeId(targetLeadId);
      const matchedTargetMember = findTeamMemberByIdentity(teams, targetLeadId, normalizeId);
      const targetIds = normalizedTarget
        ? new Set(
            [
              normalizedTarget,
              ...getTeamMemberIdentityIds(matchedTargetMember, normalizeId),
            ].filter(Boolean)
          )
        : undefined;

      return resolveAvailabilityIntervalsForDay({
        allEntries: orgAvailabilities,
        dayKey: getDayOfWeekKey(date),
        targetIds,
        normalizeId,
        toLocalClockFromUtcTime: utcClockTimeToPreferredTimeZoneClock,
      });
    },
    [availabilityIdsByOrgId, availabilitiesById, normalizeId, primaryOrgId, teams]
  );

  return {
    availabilityLoaded,
    getViewAvailabilityIntervals,
  };
};
