const mockResults = {
  UNAVAILABLE: 'unavailable',
  DENIED: 'denied',
  LIMITED: 'limited',
  GRANTED: 'granted',
  BLOCKED: 'blocked',
} as const;

export const check = jest.fn(async () => mockResults.GRANTED);
export const request = jest.fn(async () => mockResults.GRANTED);
export const RESULTS = mockResults;

export const PERMISSIONS = {
  IOS: {
    CAMERA: 'ios.permission.CAMERA',
    PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
    MICROPHONE: 'ios.permission.MICROPHONE',
    SPEECH_RECOGNITION: 'ios.permission.SPEECH_RECOGNITION',
  },
  ANDROID: {
    CAMERA: 'android.permission.CAMERA',
    READ_MEDIA_IMAGES: 'android.permission.READ_MEDIA_IMAGES',
    READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
    RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
  },
};

export default {
  check,
  request,
  PERMISSIONS,
  RESULTS,
};
