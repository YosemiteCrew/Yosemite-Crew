import React from 'react';
import {type ProfileImagePickerRef} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';
import {ProfileHeader} from '@/shared/components/common/ProfileHeader/ProfileHeader';

export interface CompanionProfileHeaderProps {
  name: string;
  breedName?: string | null;
  profileImage?: string | null;
  pickerRef: React.RefObject<ProfileImagePickerRef | null>;
  onImageSelected: (uri: string | null) => void;
  size?: number;
  showCameraButton?: boolean;
}

export const CompanionProfileHeader: React.FC<CompanionProfileHeaderProps> = ({
  name,
  breedName,
  profileImage,
  pickerRef,
  onImageSelected,
  size = 100,
  showCameraButton = true,
}) => {
  const fallbackInitial = name?.charAt(0)?.toUpperCase();
  return (
    <ProfileHeader
      title={name}
      subtitle={breedName ?? 'Unknown Breed'}
      profileImage={profileImage}
      pickerRef={pickerRef}
      onImageSelected={onImageSelected}
      size={size}
      showCameraButton={showCameraButton}
      fallbackInitial={fallbackInitial}
    />
  );
};

export default CompanionProfileHeader;
