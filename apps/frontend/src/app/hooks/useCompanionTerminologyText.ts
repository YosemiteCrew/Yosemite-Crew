import { useCallback, useMemo } from 'react';
import {
  getCompanionTerminologyForOrg,
  rewriteCompanionTerminologyText,
} from '@/app/lib/companionTerminology';
import { useOrgStore } from '@/app/stores/orgStore';

export const useCompanionTerminologyText = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );

  const terminology = useMemo(
    () => getCompanionTerminologyForOrg(primaryOrgId, primaryOrgType),
    [primaryOrgId, primaryOrgType]
  );

  return useCallback(
    (text: string) => rewriteCompanionTerminologyText(text, terminology),
    [terminology]
  );
};
