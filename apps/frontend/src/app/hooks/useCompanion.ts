import { useEffect, useMemo } from 'react';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { CompanionParent, StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import { useParentStore } from '@/app/stores/parentStore';

export const useLoadCompanionsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    const state = useCompanionStore.getState();
    if (state.status === 'loading') return;
    if (Object.hasOwn(state.companionsIdsByOrgId ?? {}, primaryOrgId)) return;
    void loadCompanionsForPrimaryOrg();
  }, [primaryOrgId]);
};

export const useCompanionsForPrimaryOrg = (): StoredCompanion[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const companionsById = useCompanionStore((s) => s.companionsById);

  const companionsIdsByOrgId = useCompanionStore((s) => s.companionsIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = companionsIdsByOrgId[primaryOrgId] ?? [];
    const companions: StoredCompanion[] = [];
    for (const id of ids) {
      const companion = companionsById[id];
      if (companion) companions.push(companion);
    }
    return companions;
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
    const pairs: CompanionParent[] = [];
    for (const id of ids) {
      const companion = companionsById[id];
      if (!companion) continue;
      const parent = parentsById[companion.parentId];
      if (!parent) continue;
      pairs.push({ companion, parent });
    }
    return pairs;
  }, [primaryOrgId, companionsById, companionsIdsByOrgId, parentsById]);
};
