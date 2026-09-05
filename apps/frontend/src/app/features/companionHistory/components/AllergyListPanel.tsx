'use client';
import React from 'react';
import AllergyList from '@/app/features/companionHistory/components/AllergyList';
import { useAllergyList } from '@/app/features/companionHistory/components/useAllergyList';

export type AllergyListPanelProps = {
  /** The companion (patient) whose allergies to load. `companionId === patientId`. */
  companionId: string;
};

/**
 * Data container for {@link AllergyList}. All state lives in
 * {@link useAllergyList}; this projects it onto the presentational list and
 * renders nothing when the member cannot view allergies.
 */
const AllergyListPanel = ({ companionId }: AllergyListPanelProps) => {
  const { canView, canEdit, allergies, loading, error, creating, resolvingId, create, resolve } =
    useAllergyList(companionId);

  if (!canView) return null;

  return (
    <AllergyList
      allergies={allergies}
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

export default AllergyListPanel;
