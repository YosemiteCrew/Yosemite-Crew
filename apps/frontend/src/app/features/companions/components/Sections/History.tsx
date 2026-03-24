import React from 'react';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import CompanionHistoryTimeline from '@/app/features/companionHistory/components/CompanionHistoryTimeline';

type HistoryType = {
  companion: CompanionParent;
};

const History = ({ companion }: HistoryType) => (
  <CompanionHistoryTimeline companionId={companion.companion.id} showDocumentUpload />
);

export default History;
