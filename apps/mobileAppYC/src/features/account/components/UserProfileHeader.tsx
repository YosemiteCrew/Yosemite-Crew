import React from 'react';
import {type ProfileImagePickerRef} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';
import {ProfileHeader} from '@/shared/components/common/ProfileHeader/ProfileHeader';

export interface UserProfileHeaderProps {
  firstName: string;
  lastName: string;
  profileImage?: string | null;
  pickerRef: React.RefObject<ProfileImagePickerRef | null>;
  onImageSelected: (uri: string | null) => void;
  size?: number;
  showCameraButton?: boolean;
}

export const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
  firstName,
  lastName,
  profileImage,
  pickerRef,
  onImageSelected,
  size = 100,
  showCameraButton = true,
}) => {
  const fullName = `${firstName} ${lastName}`.trim() || 'User Profile';
  const fallbackInitial = (firstName?.charAt(0) || lastName?.charAt(0) || 'U')
    .toUpperCase();

  return (
    <ProfileHeader
      title={fullName}
      profileImage={profileImage}
      pickerRef={pickerRef}
      onImageSelected={onImageSelected}
      size={size}
      showCameraButton={showCameraButton}
      fallbackInitial={fallbackInitial}
    />
  );
};
