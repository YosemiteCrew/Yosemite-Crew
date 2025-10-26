import React from 'react';
import {GenericEmptyScreen} from '@/components/common/GenericEmptyScreen/GenericEmptyScreen';

export const TasksScreen: React.FC = () => {
  return (
    <GenericEmptyScreen
      title="Tasks"
      subtitle="Build routines, track medications, and stay ahead with timely reminders."
    />
  );
};
