import React from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Platform,
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
}

export const ProfileImagePicker: React.FC<ProfileImagePickerProps> = ({
  imageUri,
  onImageSelected,
  size = 120,
}) => {
  const { theme } = useTheme();

  // Permission types based on platform
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

  const handlePermission = async (type: 'camera' | 'gallery') => {
    const permission = type === 'camera' ? cameraPermission : photoLibraryPermission;

    try {
      // Check current permission status
      const checkResult = await check(permission);
      console.log(`Permission check result for ${type}:`, checkResult);

      switch (checkResult) {
        case RESULTS.UNAVAILABLE:
          Alert.alert(
            'Not Available',
            `This feature is not available on your device.`
          );
          return false;

        case RESULTS.DENIED:
          // Request permission if denied
          const requestResult = await request(permission);
          console.log(`Permission request result for ${type}:`, requestResult);
          return requestResult === RESULTS.GRANTED;

        case RESULTS.LIMITED:
          console.log('Limited permission granted');
          return true;

        case RESULTS.GRANTED:
          console.log('Permission already granted');
          return true;

        case RESULTS.BLOCKED:
          Alert.alert(
            'Permission Blocked',
            `${
              type === 'camera' ? 'Camera' : 'Photo library'
            } permission is permanently blocked. Please enable it in your device settings to use this feature.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                // You can use react-native-permissions' openSettings() if available
                // or use another library like react-native-app-settings
              }},
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
  };

  const handleResponse = (response: ImagePickerResponse) => {
    if (response.didCancel) {
      console.log('Image picker cancelled by user');
      return;
    }

    if (response.errorCode) {
      console.log('Image picker error:', response.errorMessage);
      let errorMessage = 'Failed to pick image';
      
      switch (response.errorCode) {
        case 'camera_unavailable':
          errorMessage = 'Camera is not available on this device';
          break;
        case 'permission':
          errorMessage = 'Permission denied. Please check your app permissions.';
          break;
        case 'others':
          errorMessage = response.errorMessage || 'Unknown error occurred';
          break;
      }
      
      Alert.alert('Error', errorMessage);
      return;
    }

    if (response.assets && response.assets[0]) {
      const uri = response.assets[0].uri;
      if (uri) {
        onImageSelected(uri);
        console.log('Image selected successfully');
      } else {
        Alert.alert('Error', 'Failed to get image URI');
      }
    }
  };

  const openCamera = async () => {
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
      saveToPhotos: true,
      cameraType: 'front',
    };

    launchCamera(options, handleResponse);
  };

  const openGallery = async () => {
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
      selectionLimit: 1,
    };

    launchImageLibrary(options, handleResponse);
  };

  const handleImagePicker = () => {
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
  };

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
      onPress={handleImagePicker}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.imageContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.background,
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
            <Image
              source={Images.cameraIcon}
              style={[
                styles.cameraIcon,
                { tintColor: theme.colors.primary },
              ]}
              resizeMode="contain"
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

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
});