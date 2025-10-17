import React from 'react';
import {GenericEmptyScreen} from '@/components/common/GenericEmptyScreen/GenericEmptyScreen';

export const DocumentsScreen: React.FC = () => {
  return (
    <GenericEmptyScreen
      title="Documents"
      subtitle="Store vaccination records, prescriptions, and care notes for every companion."
    />
  );
};
