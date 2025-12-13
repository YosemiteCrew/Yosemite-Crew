import { useEffect, useMemo } from "react";
import { useOrgStore } from "../stores/orgStore";
import { loadDocumentsForOrgPrimaryOrg } from "../services/documentService";
import { OrganizationDocument } from "../types/document";
import { useOrganizationDocumentStore } from "../stores/documentStore";

export const useLoadDocumentsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    void loadDocumentsForOrgPrimaryOrg({ force: true });
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
