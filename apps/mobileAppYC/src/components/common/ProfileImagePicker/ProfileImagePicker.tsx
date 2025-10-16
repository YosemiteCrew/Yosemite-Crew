import React, { useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  ImageLibraryOptions,
  CameraOptions,
} from 'react-native-image-picker';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useTheme } from '../../../hooks';
import { Images } from '../../../assets/images';

interface ProfileImagePickerProps {
  imageUri?: string | null;
  onImageSelected: (uri: string) => void;
  size?: number;
  pressable?: boolean;
  onPress?: () => void;
  fallbackText?: string;
}

export const ProfileImagePicker = React.forwardRef<
  { triggerPicker: () => void },
  ProfileImagePickerProps
>(({
  imageUri,
  onImageSelected,
  size = 120,
  pressable = true,
  onPress,
  fallbackText,
}, ref) => {
  const { theme } = useTheme();

  const cameraPermission =
    Platform.OS === 'ios'
      ? PERMISSIONS.IOS.CAMERA
      : PERMISSIONS.ANDROID.CAMERA;

  const photoLibraryPermission =
    Platform.OS === 'ios'
      ? PERMISSIONS.IOS.PHOTO_LIBRARY
      : Number(Platform.Version) >= 33
      ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
      : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;

  const handlePermission = useCallback(async (type: 'camera' | 'gallery') => {
    const permission = type === 'camera' ? cameraPermission : photoLibraryPermission;

    try {
      const checkResult = await check(permission);
      console.log(`Permission check result for ${type}:`, checkResult);

      switch (checkResult) {
        case RESULTS.UNAVAILABLE:
          if (type === 'camera') {
            Alert.alert(
              'Camera Not Available',
              'Camera is not available on this device. Please use a real device to test camera features.'
            );
          } else {
            Alert.alert(
              'Not Available',
              'Photo library is not available on this device.'
            );
          }
          return false;

        case RESULTS.DENIED:
          const requestResult = await request(permission);
          console.log(`Permission request result for ${type}:`, requestResult);
          return requestResult === RESULTS.GRANTED || requestResult === RESULTS.LIMITED;

        case RESULTS.LIMITED:
          console.log('Limited permission granted');
          return true;

        case RESULTS.GRANTED:
          console.log('Permission already granted');
          return true;

        case RESULTS.BLOCKED:
          Alert.alert(
            'Permission Blocked',
            `${type === 'camera' ? 'Camera' : 'Photo library'} permission is blocked. Please enable it in Settings.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings()
              },
            ]
          );
          return false;

        default:
          return false;
      }
    } catch (error) {
      console.warn('Permission error:', error);
      Alert.alert('Error', 'Failed to check permissions');
      return false;
    }
  }, [cameraPermission, photoLibraryPermission]);

  const handleResponse = useCallback((response: ImagePickerResponse) => {
    console.log('Image picker response:', response);

    if (response.didCancel) {
      console.log('User cancelled image picker');
      return;
    }

    if (response.errorCode) {
      console.log('Image picker error:', response.errorCode, response.errorMessage);

      // Handle specific error codes as per documentation
      if (response.errorCode === 'camera_unavailable') {
        Alert.alert(
          'Camera Not Available',
          'Camera is not available. This is expected on iOS Simulator. Please test on a real device or select from gallery.'
        );
        return;
      }

      if (response.errorCode === 'permission') {
        Alert.alert(
          'Permission Denied',
          'Permission was denied. Please check your app permissions in Settings.'
        );
        return;
      }

      // Handle 'others' error code
      Alert.alert(
        'Error',
        response.errorMessage || 'An error occurred while picking the image'
      );
      return;
    }

    if (response.assets && response.assets.length > 0) {
      const asset = response.assets[0];
      if (asset.uri) {
        onImageSelected(asset.uri);
        console.log('Image selected successfully:', asset.fileName);
      } else {
        Alert.alert('Error', 'Failed to get image URI');
      }
    }
  }, [onImageSelected]);

  const openCamera = useCallback(async () => {
    const hasPermission = await handlePermission('camera');

    if (!hasPermission) {
      return;
    }

    const options: CameraOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      saveToPhotos: false, // Set to true if you want to save to device photos
      cameraType: 'front',
    };

    launchCamera(options, handleResponse);
  }, [handlePermission, handleResponse]);

  const openGallery = useCallback(async () => {
    const hasPermission = await handlePermission('gallery');

    if (!hasPermission) {
      return;
    }

    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      selectionLimit: 1, // 1 for single selection, 0 for unlimited (iOS 14+, Android 13+)
    };

    launchImageLibrary(options, handleResponse);
  }, [handlePermission, handleResponse]);

  const triggerPicker = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    Alert.alert(
      'Select Profile Image',
      'Choose how you want to select your profile image',
      [
        {
          text: 'Take Photo',
          onPress: openCamera,
        },
        {
          text: 'Choose from Gallery',
          onPress: openGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  }, [onPress, openCamera, openGallery]);

  const handleImagePicker = () => {
    triggerPicker();
  };

  React.useImperativeHandle(ref, () => ({
    triggerPicker,
  }));

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      onPress={pressable ? handleImagePicker : undefined}
      activeOpacity={pressable ? 0.8 : 1}
    >
      <View
        style={[
          styles.imageContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.lightBlueBackground,
          },
        ]}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[
              styles.profileImage,
              { width: size, height: size, borderRadius: size / 2 },
            ]}
            onError={(error) => {
              console.log('Error loading image:', error.nativeEvent.error);
              Alert.alert('Error', 'Failed to load profile image');
            }}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            {fallbackText ? (
              <Text style={[styles.fallbackText, { color: theme.colors.primary }]}>
                {fallbackText}
              </Text>
            ) : (
              <Image
                source={Images.cameraIcon}
                style={[
                  styles.cameraIcon,
                  { tintColor: theme.colors.primary },
                ]}
                resizeMode="contain"
              />
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

ProfileImagePicker.displayName = 'ProfileImagePicker';

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  imageContainer: {
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  cameraIcon: {
    width: 40,
    height: 40,
  },
  fallbackText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
