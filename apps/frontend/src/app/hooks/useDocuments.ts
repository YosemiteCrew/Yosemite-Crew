import { useEffect, useMemo } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { loadDocumentsForOrgPrimaryOrg } from '@/app/features/documents/services/documentService';
import { OrganizationDocument } from '@/app/features/documents/types/document';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';

export const useLoadDocumentsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const documentIdsByOrgId = useOrganizationDocumentStore((s) => s.documentIdsByOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (useOrganizationDocumentStore.getState().status === 'loading') return;
    if (Object.hasOwn(documentIdsByOrgId, primaryOrgId)) return;
    void loadDocumentsForOrgPrimaryOrg();
  }, [primaryOrgId, documentIdsByOrgId]);
};

export const useDocumentsForPrimaryOrg = (): OrganizationDocument[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const documentsById = useOrganizationDocumentStore((s) => s.documentsById);

  const documentIdsByOrgId = useOrganizationDocumentStore((s) => s.documentIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = documentIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => documentsById[id]).filter(Boolean);
  }, [primaryOrgId, documentsById, documentIdsByOrgId]);
};
