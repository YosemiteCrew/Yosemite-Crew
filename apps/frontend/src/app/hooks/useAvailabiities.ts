import { useEffect, useMemo } from "react";
import { loadAvailability } from "../services/availability";
import { useOrgStore } from "../stores/orgStore";
import { useAvailabilityStore } from "../stores/availabilityStore";
import {
  AvailabilityState,
  convertFromGetApi,
} from "../components/Availability/utils";

export const useLoadAvailabilities = () => {
  const availabilityStatus = useAvailabilityStore((s) => s.status);
  const orgIds = useOrgStore((s) => s.orgIds);

  useEffect(() => {
    if (!orgIds || orgIds.length === 0) return;
    if (availabilityStatus === "idle") {
      void loadAvailability();
    }
  }, [availabilityStatus, orgIds]);
};

export const usePrimaryAvailability = (): {
  availabilities: AvailabilityState | null;
} => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const availabilityIdsByOrgId = useAvailabilityStore(
    (s) => s.availabilityIdsByOrgId
  );
  const availabilitiesById = useAvailabilityStore((s) => s.availabilitiesById);

  return useMemo(() => {
    if (!primaryOrgId) return { availabilities: null };
    const ids = availabilityIdsByOrgId[primaryOrgId] ?? [];
    const temp = ids.map((id) => availabilitiesById[id]).filter(Boolean);
    return {
      availabilities: convertFromGetApi(temp),
    };
  }, [primaryOrgId, availabilityIdsByOrgId, availabilitiesById]);
};
