import { useMemo } from "react";
import { useFormsStore } from "../stores/formsStore";
import { FormsCategory, FormsProps } from "../types/forms";
import { useOrgStore } from "../stores/orgStore";

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
