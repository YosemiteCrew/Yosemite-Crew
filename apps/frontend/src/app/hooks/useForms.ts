import { useEffect, useMemo } from 'react';
import { useFormsStore } from '@/app/stores/formsStore';
import { FormsCategory, FormsProps } from '@/app/features/forms/types/forms';
import { useOrgStore } from '@/app/stores/orgStore';
import { loadForms } from '@/app/features/forms/services/formService';

export const useLoadFormsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const loading = useFormsStore((s) => s.loading);
  const lastFetchedByOrgId = useFormsStore((s) => s.lastFetchedByOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (loading) return;
    if (lastFetchedByOrgId[primaryOrgId]) return;
    void loadForms();
  }, [primaryOrgId, loading, lastFetchedByOrgId]);
};

export const useFormsForPrimaryOrgByCategory = (category: FormsCategory): FormsProps[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const formIds = useFormsStore((s) => s.formIds);
  const formsById = useFormsStore((s) => s.formsById);

  return useMemo(() => {
    if (!primaryOrgId) return [];

    return formIds
      .map((id) => formsById[id])
      .filter((form): form is FormsProps => {
        if (!form) return false;
        return form.orgId === primaryOrgId && form.category === category;
      });
  }, [primaryOrgId, category, formsById, formIds]);
};
