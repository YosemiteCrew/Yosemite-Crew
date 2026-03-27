import React from 'react';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import CompanionHistoryTimeline from '@/app/features/companionHistory/components/CompanionHistoryTimeline';

type HistoryType = {
  companion: CompanionParent;
};

const History = ({ companion }: HistoryType) => (
  <CompanionHistoryTimeline
    companionId={companion.companion.id}
    showDocumentUpload
    compact
    fullPageHref={`/companions/history?${new URLSearchParams({
      companionId: companion.companion.id,
      source: 'companions',
      backTo: `/companions?${new URLSearchParams({
        companionId: companion.companion.id,
      }).toString()}`,
    }).toString()}`}
  />
);

export default History;
