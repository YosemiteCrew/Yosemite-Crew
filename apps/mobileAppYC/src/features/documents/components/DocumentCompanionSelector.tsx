import React from 'react';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import type {Companion} from '@/features/companion/types';

type DocumentCompanionSelectorProps = {
  companions: Companion[];
  selectedCompanionId: string | null;
  onSelect: (id: string) => void;
  containerStyle?: any;
};

export const DocumentCompanionSelector: React.FC<DocumentCompanionSelectorProps> = ({
  companions,
  selectedCompanionId,
  onSelect,
  containerStyle,
}) => {
  return (
    <CompanionSelector
      companions={companions}
      selectedCompanionId={selectedCompanionId}
      onSelect={onSelect}
      showAddButton={false}
      containerStyle={containerStyle}
      requiredPermission="documents"
      permissionLabel="documents"
    />
  );
};
