import React from 'react';
import {GenericEmptyScreen} from '@/components/common/GenericEmptyScreen/GenericEmptyScreen';

export const AppointmentsScreen: React.FC = () => {
  return (
    <GenericEmptyScreen
      title="Appointments"
      subtitle="Your upcoming veterinary visits will appear here once scheduled."
    />
  );
};
