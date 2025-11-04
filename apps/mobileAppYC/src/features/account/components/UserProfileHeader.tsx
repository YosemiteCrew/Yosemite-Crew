import React, {useMemo} from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {
  ProfileImagePicker,
  type ProfileImagePickerRef,
} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

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
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const fullName = `${firstName} ${lastName}`.trim();
  const fallbackInitial = (firstName?.charAt(0) || lastName?.charAt(0) || 'U').toUpperCase();

  return (
    <View style={styles.profileHeader}>
      <View style={styles.avatarContainer}>
        <ProfileImagePicker
          ref={pickerRef}
          imageUri={profileImage ?? undefined}
          onImageSelected={onImageSelected}
          size={size}
          pressable={false}
          fallbackText={fallbackInitial}
        />
        {showCameraButton ? (
          <TouchableOpacity
            style={styles.cameraIconContainer}
            onPress={() => pickerRef.current?.triggerPicker()}>
            <Image source={Images.cameraIcon} style={styles.cameraIcon} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.profileName}>{fullName || 'User Profile'}</Text>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    profileHeader: {
      alignItems: 'center',
      marginBottom: theme.spacing[6],
    },
    avatarContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraIconContainer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.white,
    },
    cameraIcon: {
      width: 18,
      height: 18,
      tintColor: theme.colors.white,
    },
    profileName: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
      marginTop: theme.spacing['4'],
    },
  });

