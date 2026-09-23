'use client';
import React, { useEffect, useState } from 'react';
import ConsentList from '@/app/features/companionHistory/components/ConsentList';
import { useConsentList } from '@/app/features/companionHistory/components/useConsentList';
import { loadConsentDocumentsForCompanion } from '@/app/features/companions/services/companionDocumentService';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';

export type ConsentListPanelProps = {
  /** The companion (patient) whose consents to load. `companionId === patientId`. */
  companionId: string;
};

/**
 * The manually-recorded consents ({@link useConsentList}) are a separate data
 * model from the signed PDFs the e-signing portal (Documenso) produces - there
 * is no field linking one to the other, so this loads them independently
 * rather than guessing a correspondence.
 */
const useSignedConsentDocuments = (companionId: string, canView: boolean) => {
  const [documents, setDocuments] = useState<CompanionRecord[]>([]);

  // Reset during render (React's recommended pattern, mirrors
  // useConsentRecords above) rather than in the effect, so a companion
  // change or a permission loss clears stale documents in the same render
  // instead of a synchronous setState inside the effect body.
  const [loadedFor, setLoadedFor] = useState({ companionId, canView });
  if (companionId !== loadedFor.companionId || canView !== loadedFor.canView) {
    setLoadedFor({ companionId, canView });
    setDocuments([]);
  }

  useEffect(() => {
    if (!canView || !companionId) return;
    let active = true;
    loadConsentDocumentsForCompanion(companionId)
      .then((docs) => {
        if (active) setDocuments(docs);
      })
      .catch(() => {
        if (active) setDocuments([]);
      });
    return () => {
      active = false;
    };
  }, [canView, companionId]);

  return documents;
};

/**
 * Data container for {@link ConsentList}. All state lives in
 * {@link useConsentList}; this projects it onto the presentational list and
 * renders nothing when the member cannot view consents.
 */
const ConsentListPanel = ({ companionId }: ConsentListPanelProps) => {
  const { canView, canEdit, consents, loading, error, creating, revokingId, grant, revoke } =
    useConsentList(companionId);
  const signedDocuments = useSignedConsentDocuments(companionId, canView);

  if (!canView) return null;

  return (
    <ConsentList
      consents={consents}
      loading={loading}
      error={error}
      canEdit={canEdit}
      onGrant={grant}
      onRevoke={revoke}
      creating={creating}
      revokingId={revokingId}
      signedDocuments={signedDocuments}
    />
  );
};

export default ConsentListPanel;
