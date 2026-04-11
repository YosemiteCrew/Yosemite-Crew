import { useEffect, useMemo } from 'react';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { CompanionParent, StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import { useParentStore } from '@/app/stores/parentStore';

export const useLoadCompanionsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const companionsIdsByOrgId = useCompanionStore((s) => s.companionsIdsByOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (useCompanionStore.getState().status === 'loading') return;
    if (Object.hasOwn(companionsIdsByOrgId, primaryOrgId)) return;
    void loadCompanionsForPrimaryOrg();
  }, [primaryOrgId, companionsIdsByOrgId]);
};

export const useCompanionsForPrimaryOrg = (): StoredCompanion[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const companionsById = useCompanionStore((s) => s.companionsById);

  const companionsIdsByOrgId = useCompanionStore((s) => s.companionsIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = companionsIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => companionsById[id]).filter(Boolean);
  }, [primaryOrgId, companionsById, companionsIdsByOrgId]);
};

export const useCompanionsParentsForPrimaryOrg = (): CompanionParent[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const companionsById = useCompanionStore((s) => s.companionsById);
  const companionsIdsByOrgId = useCompanionStore((s) => s.companionsIdsByOrgId);

  const parentsById = useParentStore((s) => s.parentsById);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = companionsIdsByOrgId[primaryOrgId] ?? [];
    return ids
      .map((id) => companionsById[id])
      .filter(Boolean)
      .map((companion) => {
        const parent = parentsById[companion.parentId];
        if (!parent) return null;
        return { companion, parent };
      })
      .filter((x): x is CompanionParent => x != null);
  }, [primaryOrgId, companionsById, companionsIdsByOrgId, parentsById]);
};
