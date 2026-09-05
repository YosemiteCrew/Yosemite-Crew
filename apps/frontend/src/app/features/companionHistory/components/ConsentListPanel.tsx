'use client';
import React from 'react';
import ConsentList from '@/app/features/companionHistory/components/ConsentList';
import { useConsentList } from '@/app/features/companionHistory/components/useConsentList';

export type ConsentListPanelProps = {
  /** The companion (patient) whose consents to load. `companionId === patientId`. */
  companionId: string;
};

/**
 * Data container for {@link ConsentList}. All state lives in
 * {@link useConsentList}; this projects it onto the presentational list and
 * renders nothing when the member cannot view consents.
 */
const ConsentListPanel = ({ companionId }: ConsentListPanelProps) => {
  const { canView, canEdit, consents, loading, error, creating, revokingId, grant, revoke } =
    useConsentList(companionId);

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
    />
  );
};

export default ConsentListPanel;
