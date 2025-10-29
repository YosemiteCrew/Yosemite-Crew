import React from 'react';
import {GenericEmptyScreen} from '@/shared/screens/common/GenericEmptyScreen';
import {Images} from '@/assets/images';

export const EmptyTasksScreen: React.FC = () => {
  return (
    <GenericEmptyScreen
      headerTitle="Tasks"
      emptyImage={Images.emptyDocuments}
      title="No tasks yet!"
      subtitle={String.raw`Add a companion first to start creating tasks\nfor their health, hygiene, and care!`}
      showBackButton={false}
    />
  );
};

export default EmptyTasksScreen;
