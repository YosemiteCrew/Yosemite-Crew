import React from 'react';
import { RecordStatus } from '@yosemite-crew/types';
import ChangeStatusModal from '@/app/ui/overlays/Modal/ChangeStatusModal';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { updateCompanion } from '@/app/features/companions/services/companionService';

type ChangeCompanionStatusProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeCompanion: CompanionParent;
};

const CompanionStatusOptions: Array<{ value: RecordStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const canTransitionCompanionStatus = () => true;

const getInvalidCompanionStatusTransitionMessage = (from: RecordStatus, to: RecordStatus) =>
  `Cannot change companion status from ${from} to ${to}.`;

const ChangeCompanionStatus = ({
  showModal,
  setShowModal,
  activeCompanion,
}: ChangeCompanionStatusProps) => {
  const currentStatus: RecordStatus = activeCompanion.companion.status ?? 'active';

  return (
    <ChangeStatusModal<RecordStatus>
      showModal={showModal}
      setShowModal={setShowModal}
      currentStatus={currentStatus}
      defaultStatus={currentStatus}
      statusOptions={CompanionStatusOptions}
      placeholder="Companion status"
      canTransition={canTransitionCompanionStatus}
      getInvalidMessage={getInvalidCompanionStatusTransitionMessage}
      onSave={async (newStatus) => {
        await updateCompanion({
          ...activeCompanion.companion,
          status: newStatus,
        });
      }}
    />
  );
};

export default ChangeCompanionStatus;
