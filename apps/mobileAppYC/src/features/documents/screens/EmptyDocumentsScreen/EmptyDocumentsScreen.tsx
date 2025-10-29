import React from 'react';
import {GenericEmptyScreen} from '@/shared/screens/common/GenericEmptyScreen';
import {Images} from '@/assets/images';

export const EmptyDocumentsScreen: React.FC = () => {
  return (
    <GenericEmptyScreen
      headerTitle="Documents"
      emptyImage={Images.emptyDocuments}
      title="Meow-nothing here."
      subtitle={`Hey there! Feel free to drop your vaccine or\nmedical reports right here!`}
      showBackButton={false}
    />
  );
};
