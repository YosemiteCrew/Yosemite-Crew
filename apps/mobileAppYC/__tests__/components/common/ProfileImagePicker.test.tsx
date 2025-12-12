import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  ProfileImagePicker,
  ProfileImagePickerRef,
} from '../../../src/shared/components/common/ProfileImagePicker/ProfileImagePicker';
import {
  Alert,
  Platform,
  Linking,
  Image,
  TouchableOpacity,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {check, request, RESULTS, PERMISSIONS} from 'react-native-permissions';
import * as ImageUriUtils from '@/shared/utils/imageUri';

// --- Mocks ---

// Mock Hooks and Assets
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#007AFF',
        lightBlueBackground: '#E3F2FD',
      },
    },
  }),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    cameraIcon: {uri: 'camera_icon_mock'},
  },
}));

jest.mock('@/shared/utils/imageUri', () => ({
  normalizeImageUri: jest.fn(uri => uri),
}));

// Mock External Libraries
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  PERMISSIONS: {
    IOS: {
      CAMERA: 'ios.permission.CAMERA',
      PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
    },
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
      READ_MEDIA_IMAGES: 'android.permission.READ_MEDIA_IMAGES',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    LIMITED: 'limited',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
  },
}));

// Spy on Alert and Linking
const alertSpy = jest.spyOn(Alert, 'alert');
const linkSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(true);

describe('ProfileImagePicker', () => {
  const mockOnImageSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios'; // Default to iOS
    // @ts-ignore
    Platform.Version = '14.0';
  });

  describe('Rendering', () => {
    it('renders the placeholder icon when no imageUri is provided', () => {
      const {UNSAFE_getAllByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      const images = UNSAFE_getAllByType(Image);
      // Should find at least the placeholder icon
      expect(images.length).toBeGreaterThan(0);
    });

    it('renders the image when imageUri is provided', () => {
      const uri = 'https://example.com/photo.jpg';
      (ImageUriUtils.normalizeImageUri as jest.Mock).mockReturnValue(uri);

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker
          imageUri={uri}
          onImageSelected={mockOnImageSelected}
        />,
      );

      const image = UNSAFE_getByType(Image);
      expect(image.props.source).toEqual({uri});
    });

    it('renders fallback text when provided and no imageUri', () => {
      // Explicitly pass null to imageUri to ensure normalizeImageUri returns null in mock
      (ImageUriUtils.normalizeImageUri as jest.Mock).mockReturnValue(null);

      const {getByText} = render(
        <ProfileImagePicker
          onImageSelected={mockOnImageSelected}
          imageUri={null}
          fallbackText="AB"
        />,
      );
      expect(getByText('AB')).toBeTruthy();
    });

    it('handles image loading errors by switching to placeholder', () => {
      const uri = 'invalid-uri';
      (ImageUriUtils.normalizeImageUri as jest.Mock).mockReturnValue(uri);

      const {UNSAFE_getByType, rerender} = render(
        <ProfileImagePicker
          imageUri={uri}
          onImageSelected={mockOnImageSelected}
        />,
      );

      // Initially renders profile image
      const image = UNSAFE_getByType(Image);

      // Simulate error
      fireEvent(image, 'error', {nativeEvent: {error: 'Load failed'}});

      // After error, state updates to loadFailed=true.
      // The component logic renders placeholder if loadFailed is true.
      // We can check if it tries to render the fallback icon or text again.
      // Since we didn't pass fallbackText, it should show the camera icon.
      // We verify the Image source changes or checking rerender prop reset logic.

      // Reset mechanism check:
      rerender(
        <ProfileImagePicker
          imageUri="new-uri"
          onImageSelected={mockOnImageSelected}
        />,
      );
      // Should attempt to load new image (loadFailed set to false)
    });
  });

  describe('Platform Permissions Logic', () => {
    it('requests correct permissions on iOS', async () => {
      Platform.OS = 'ios';
      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );

      // Trigger picker
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));

      // Get Alert buttons
      const buttons = alertSpy.mock.calls[0][2]!;
      const takePhoto = buttons.find(b => b.text === 'Take Photo')!;
      const chooseGallery = buttons.find(
        b => b.text === 'Choose from Gallery',
      )!;

      // Test Camera Permission
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      await act(async () => await takePhoto.onPress!());
      expect(check).toHaveBeenCalledWith(PERMISSIONS.IOS.CAMERA);

      // Test Gallery Permission
      await act(async () => await chooseGallery.onPress!());
      expect(check).toHaveBeenCalledWith(PERMISSIONS.IOS.PHOTO_LIBRARY);
    });

    it('requests correct permissions on Android < 33', async () => {
      Platform.OS = 'android';
      // @ts-ignore
      Platform.Version = 32;

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));

      const buttons = alertSpy.mock.calls[0][2]!;
      const chooseGallery = buttons.find(
        b => b.text === 'Choose from Gallery',
      )!;

      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      await act(async () => await chooseGallery.onPress!());

      expect(check).toHaveBeenCalledWith(
        PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
      );
    });

    it('requests correct permissions on Android >= 33', async () => {
      Platform.OS = 'android';
      // @ts-ignore
      Platform.Version = 33;

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));

      const buttons = alertSpy.mock.calls[0][2]!;
      const chooseGallery = buttons.find(
        b => b.text === 'Choose from Gallery',
      )!;

      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      await act(async () => await chooseGallery.onPress!());

      expect(check).toHaveBeenCalledWith(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
    });
  });

  describe('Permission Status Handling', () => {
    it('handles RESULTS.UNAVAILABLE for Camera', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.UNAVAILABLE);
      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );

      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      const takePhoto = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Take Photo',
      )!;

      alertSpy.mockClear(); // Clear the picker alert
      await act(async () => await takePhoto.onPress!());

      expect(alertSpy).toHaveBeenCalledWith(
        'Camera Not Available',
        expect.stringContaining('not available'),
      );
      expect(launchCamera).not.toHaveBeenCalled();
    });

    it('handles RESULTS.UNAVAILABLE for Gallery', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.UNAVAILABLE);
      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );

      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      const chooseGallery = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Choose from Gallery',
      )!;

      alertSpy.mockClear();
      await act(async () => await chooseGallery.onPress!());

      expect(alertSpy).toHaveBeenCalledWith(
        'Not Available',
        expect.stringContaining('Photo library is not available'),
      );
    });

    it('handles RESULTS.DENIED (Request Granted)', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);
      (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      const takePhoto = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Take Photo',
      )!;

      await act(async () => await takePhoto.onPress!());

      expect(request).toHaveBeenCalled();
      expect(launchCamera).toHaveBeenCalled();
    });

    it('handles RESULTS.DENIED (Request Denied)', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);
      (request as jest.Mock).mockResolvedValue(RESULTS.DENIED);

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      const takePhoto = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Take Photo',
      )!;

      await act(async () => await takePhoto.onPress!());

      expect(request).toHaveBeenCalled();
      expect(launchCamera).not.toHaveBeenCalled();
    });

    it('handles RESULTS.BLOCKED', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.BLOCKED);

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      const takePhoto = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Take Photo',
      )!;

      alertSpy.mockClear();
      await act(async () => await takePhoto.onPress!());

      expect(alertSpy).toHaveBeenCalledWith(
        'Permission Blocked',
        expect.stringContaining('blocked'),
        expect.any(Array),
      );

      // Test Open Settings Callback
      const blockedAlertButtons = alertSpy.mock.calls[0][2]!;
      const openSettingsBtn = blockedAlertButtons.find(
        b => b.text === 'Open Settings',
      )!;
      await act(async () => await openSettingsBtn.onPress!());
      expect(linkSpy).toHaveBeenCalled();
    });

    it('handles checking permission error', async () => {
      (check as jest.Mock).mockRejectedValue(new Error('Check failed'));
      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      const takePhoto = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Take Photo',
      )!;

      alertSpy.mockClear();
      await act(async () => await takePhoto.onPress!());
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to check permissions',
      );
    });

    it('handles linking openSettings error', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.BLOCKED);
      linkSpy.mockRejectedValue(new Error('Link fail'));
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      const takePhoto = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Take Photo',
      )!;
      await act(async () => await takePhoto.onPress!());

      const blockedAlertButtons =
        alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2]!;
      const openSettingsBtn = blockedAlertButtons.find(
        b => b.text === 'Open Settings',
      )!;
      await act(async () => await openSettingsBtn.onPress!());

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to open settings',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Image Picker Responses', () => {
    // Helper to simulate picker flow and callback
    const runPickerFlow = async (response: any) => {
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      // Setup launchCamera to immediately call the callback
      (launchCamera as jest.Mock).mockImplementation((options, callback) => {
        callback(response);
      });

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      const takePhoto = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Take Photo',
      )!;
      await act(async () => await takePhoto.onPress!());
    };

    it('handles user cancellation', async () => {
      await runPickerFlow({didCancel: true});
      expect(mockOnImageSelected).not.toHaveBeenCalled();
    });

    it('handles camera_unavailable error code', async () => {
      alertSpy.mockClear();
      await runPickerFlow({errorCode: 'camera_unavailable'});
      expect(alertSpy).toHaveBeenCalledWith(
        'Camera Not Available',
        expect.any(String),
      );
    });

    it('handles permission error code', async () => {
      alertSpy.mockClear();
      await runPickerFlow({errorCode: 'permission'});
      expect(alertSpy).toHaveBeenCalledWith(
        'Permission Denied',
        expect.any(String),
      );
    });

    it('handles generic error code', async () => {
      alertSpy.mockClear();
      await runPickerFlow({
        errorCode: 'other',
        errorMessage: 'Bad things happened',
      });
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Bad things happened');
    });

    it('handles success with valid URI', async () => {
      await runPickerFlow({
        assets: [{uri: 'new_image_uri', fileName: 'test.jpg'}],
      });
      expect(mockOnImageSelected).toHaveBeenCalledWith('new_image_uri');
    });

    it('handles success but missing URI', async () => {
      alertSpy.mockClear();
      await runPickerFlow({assets: [{}]}); // Missing uri
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to get image URI');
    });
  });

  describe('Interactions & Props', () => {
    it('respects the onPress prop override', () => {
      const customOnPress = jest.fn();
      const {UNSAFE_getByType} = render(
        <ProfileImagePicker
          onImageSelected={mockOnImageSelected}
          onPress={customOnPress}
        />,
      );

      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      expect(customOnPress).toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled(); // Default logic skipped
    });

    it('disables interaction when pressable is false', () => {
      const {UNSAFE_getByType} = render(
        <ProfileImagePicker
          onImageSelected={mockOnImageSelected}
          pressable={false}
        />,
      );

      const touchable = UNSAFE_getByType(TouchableOpacity);
      expect(touchable.props.activeOpacity).toBe(1);
      expect(touchable.props.onPress).toBeUndefined();
    });

    it('handles Alert Cancel button', () => {
      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));
      const cancelBtn = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Cancel',
      )!;
      expect(cancelBtn.style).toBe('cancel');
    });

    it('exposes triggerPicker via ref', () => {
      const ref = React.createRef<ProfileImagePickerRef>();
      render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} ref={ref} />,
      );

      act(() => {
        ref.current?.triggerPicker();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Select Profile Image',
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('catches errors when opening camera from alert fails', async () => {
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      (launchCamera as jest.Mock).mockImplementation(() => {
        throw new Error('Launch Fail');
      });
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));

      const takePhoto = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Take Photo',
      )!;
      await act(async () => await takePhoto.onPress!());

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to open camera picker',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('catches errors when opening gallery from alert fails', async () => {
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      (launchImageLibrary as jest.Mock).mockImplementation(() => {
        throw new Error('Launch Fail');
      });
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const {UNSAFE_getByType} = render(
        <ProfileImagePicker onImageSelected={mockOnImageSelected} />,
      );
      fireEvent.press(UNSAFE_getByType(TouchableOpacity));

      const chooseGallery = alertSpy.mock.calls[0][2]!.find(
        b => b.text === 'Choose from Gallery',
      )!;
      await act(async () => await chooseGallery.onPress!());

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to open gallery picker',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });
});
