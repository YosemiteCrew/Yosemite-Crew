import { useEffect, useMemo } from "react";
import { useFormsStore } from "../stores/formsStore";
import { FormsCategory, FormsProps } from "../types/forms";
import { useOrgStore } from "../stores/orgStore";
import { loadForms } from "../services/formService";

export const useLoadFormsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    void loadForms();
  }, [primaryOrgId]);
};

export const useFormsForPrimaryOrgByCategory = (
  category: FormsCategory
): FormsProps[] => {
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
