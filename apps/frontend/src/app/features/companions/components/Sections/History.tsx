import React from 'react';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import CompanionHistoryTimeline from '@/app/features/companionHistory/components/CompanionHistoryTimeline';
import { buildCompanionOverviewHref } from '@/app/lib/companionHistoryRoute';

type HistoryType = {
  companion: CompanionParent;
};

const History = ({ companion }: HistoryType) => (
  <CompanionHistoryTimeline
    companionId={companion.companion.id}
    showDocumentUpload
    compact
    fullPageHref={buildCompanionOverviewHref(
      companion.companion.id,
      `/companions?${new URLSearchParams({
        companionId: companion.companion.id,
      }).toString()}`
    )}
  />
);

export default History;
