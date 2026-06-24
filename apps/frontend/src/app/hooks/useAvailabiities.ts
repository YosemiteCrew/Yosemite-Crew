import { useEffect, useMemo } from 'react';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useAuthStore } from '@/app/stores/authStore';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import {
  ApiDayAvailability,
  AvailabilityState,
  convertFromGetApi,
} from '@/app/features/appointments/components/Availability/utils';

export const useLoadAvailabilities = () => {
  const authStatus = useAuthStore((s) => s.status);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const availabilityIdsByOrgId = useAvailabilityStore((s) => s.availabilityIdsByOrgId);
  const isAuthed = authStatus === 'authenticated' || authStatus === 'signin-authenticated';

  useEffect(() => {
    if (!isAuthed) return;
    if (!primaryOrgId) return;
    const isLoaded = availabilityIdsByOrgId
      ? Object.hasOwn(availabilityIdsByOrgId, primaryOrgId)
      : false;
    if (!isLoaded && useAvailabilityStore.getState().status !== 'loading') {
      void loadAvailability({ silent: true, orgId: primaryOrgId });
    }
  }, [isAuthed, primaryOrgId, availabilityIdsByOrgId]);
};

export const usePrimaryAvailability = (): {
  availabilities: AvailabilityState | null;
} => {
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const { membership } = usePrimaryOrgWithMembership();
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
    const practitionerId = normalizeId(membership?.practitionerReference);
    const membershipIds = new Set(
      [
        practitionerId,
        normalizeId(membership?.id),
        normalizeId((membership as any)?.userId),
      ].filter(Boolean)
    );
    const authId = normalizeId(authUserId);
    const findUserRows = (targetIds: Set<string>) =>
      targetIds.size > 0
        ? temp.filter(
            (item) => isUserSpecificAvailability(item) && targetIds.has(normalizeId(item.userId))
          )
        : [];
    const practitionerRows = findUserRows(membershipIds);
    const authRows =
      practitionerRows.length > 0 ? [] : findUserRows(new Set([authId].filter(Boolean)));
    const userRows = practitionerRows.length > 0 ? practitionerRows : authRows;
    const selectedRows =
      userRows.length > 0 ? userRows : temp.filter((item) => !isUserSpecificAvailability(item));
    return {
      availabilities: convertFromGetApi(selectedRows),
    };
  }, [authUserId, membership, primaryOrgId, availabilityIdsByOrgId, availabilitiesById]);
};
