import { useEffect, useMemo } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { loadDocumentsForOrgPrimaryOrg } from "@/app/features/documents/services/documentService";
import { OrganizationDocument } from "@/app/features/documents/types/document";
import { useOrganizationDocumentStore } from "@/app/stores/documentStore";

export const useLoadDocumentsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    void loadDocumentsForOrgPrimaryOrg();
  }, [primaryOrgId]);
};

export const useDocumentsForPrimaryOrg = (): OrganizationDocument[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const documentsById = useOrganizationDocumentStore((s) => s.documentsById);

  const documentIdsByOrgId = useOrganizationDocumentStore(
    (s) => s.documentIdsByOrgId
  );

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = documentIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => documentsById[id]).filter(Boolean);
  }, [primaryOrgId, documentsById, documentIdsByOrgId]);
};
