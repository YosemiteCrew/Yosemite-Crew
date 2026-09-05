'use client';

import React from 'react';
import FlagList from '@/app/features/companionHistory/components/FlagList';
import { usePatientFlags } from '@/app/features/companionHistory/components/usePatientFlags';

export type FlagListPanelProps = {
  /** The companion (patient) whose flags to load. `companionId === patientId`. */
  companionId: string;
};

/**
 * Data container for {@link FlagList}. All state lives in
 * {@link usePatientFlags}; this projects it onto the presentational list and
 * renders nothing when the member cannot view flags.
 */
const FlagListPanel = ({ companionId }: FlagListPanelProps) => {
  const { canView, canEdit, flags, loading, error, creating, resolvingId, create, resolve } =
    usePatientFlags(companionId);

  if (!canView) return null;

  return (
    <FlagList
      flags={flags}
      loading={loading}
      error={error}
      canEdit={canEdit}
      onCreate={create}
      onResolve={resolve}
      creating={creating}
      resolvingId={resolvingId}
    />
  );
};

export default FlagListPanel;
