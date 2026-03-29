import { useEffect, useMemo } from 'react';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useAuthStore } from '@/app/stores/authStore';
import {
  ApiDayAvailability,
  AvailabilityState,
  convertFromGetApi,
} from '@/app/features/appointments/components/Availability/utils';

export const useLoadAvailabilities = () => {
  const availabilityStatus = useAvailabilityStore((s) => s.status);
  const orgIds = useOrgStore((s) => s.orgIds);

  useEffect(() => {
    if (!orgIds || orgIds.length === 0) return;
    if (availabilityStatus === 'idle') {
      void loadAvailability();
    }
  }, [availabilityStatus, orgIds]);
};

export const usePrimaryAvailability = (): {
  availabilities: AvailabilityState | null;
} => {
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const availabilityIdsByOrgId = useAvailabilityStore((s) => s.availabilityIdsByOrgId);
  const availabilitiesById = useAvailabilityStore((s) => s.availabilitiesById);

  const normalizeId = (value?: string) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase() ?? '';

  const isUserSpecificAvailability = (item: ApiDayAvailability): boolean =>
    Boolean(item.userId && String(item.userId).trim());

  return useMemo(() => {
    if (!primaryOrgId) return { availabilities: null };
    const ids = availabilityIdsByOrgId[primaryOrgId] ?? [];
    const temp = ids.map((id) => availabilitiesById[id]).filter(Boolean);
    const normalizedAuthUserId = normalizeId(authUserId);
    const userRows =
      normalizedAuthUserId.length > 0
        ? temp.filter(
            (item) =>
              isUserSpecificAvailability(item) && normalizeId(item.userId) === normalizedAuthUserId
          )
        : [];
    const selectedRows =
      userRows.length > 0 ? userRows : temp.filter((item) => !isUserSpecificAvailability(item));
    return {
      availabilities: convertFromGetApi(selectedRows),
    };
  }, [authUserId, primaryOrgId, availabilityIdsByOrgId, availabilitiesById]);
};
