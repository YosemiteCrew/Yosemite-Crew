import {
  DeviceEventEmitter,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

interface VisitVoiceNativeModule {
  addListener(eventType: string): void;
  removeListeners(count: number): void;
  isAvailable(): Promise<boolean>;
  isReadBackAvailable(): Promise<boolean>;
  recognize(locale: string): Promise<string>;
  cancelRecognition(): Promise<boolean>;
  speak(text: string, locale: string): Promise<boolean>;
  stopSpeaking(): Promise<boolean>;
}

const READ_BACK_FINISHED_EVENT = 'visitVoiceReadBackFinished';

export type VoiceCaptureResult =
  {status: 'ok'; text: string} | {status: 'denied' | 'unavailable' | 'error'};

const getModule = (): VisitVoiceNativeModule | null =>
  ((NativeModules as Record<string, unknown>).VisitVoice as
    VisitVoiceNativeModule | undefined) ?? null;

const acceptsPermission = (status: string): boolean =>
  status === RESULTS.GRANTED || status === RESULTS.LIMITED;

const requiredPermissions = (): string[] => {
  if (Platform.OS === 'android') {
    return [PERMISSIONS.ANDROID.RECORD_AUDIO];
  }
  if (Platform.OS === 'ios') {
    return [PERMISSIONS.IOS.MICROPHONE, PERMISSIONS.IOS.SPEECH_RECOGNITION];
  }
  return [];
};

const requestVoicePermissions = async (): Promise<boolean> => {
  for (const permission of requiredPermissions()) {
    const current = await check(permission as never);
    if (acceptsPermission(current)) continue;
    if (!acceptsPermission(await request(permission as never))) return false;
  }
  return true;
};

export const isVisitVoiceAvailable = async (): Promise<boolean> => {
  try {
    return (await getModule()?.isAvailable()) ?? false;
  } catch {
    return false;
  }
};

export const isVisitReadBackAvailable = async (): Promise<boolean> => {
  try {
    return (await getModule()?.isReadBackAvailable()) ?? false;
  } catch {
    return false;
  }
};

export const onVisitReadBackFinished = (listener: () => void): (() => void) => {
  const native = getModule();
  const emitter =
    Platform.OS === 'ios' && native
      ? new NativeEventEmitter(native)
      : DeviceEventEmitter;
  const subscription = emitter.addListener(READ_BACK_FINISHED_EVENT, listener);
  return () => subscription.remove();
};

export const cancelVisitVoiceCapture = async (): Promise<boolean> => {
  try {
    return (await getModule()?.cancelRecognition()) ?? false;
  } catch {
    return false;
  }
};

export const captureVisitVoice = async (
  locale: string,
): Promise<VoiceCaptureResult> => {
  const native = getModule();
  if (!native) return {status: 'unavailable'};

  try {
    if (!(await requestVoicePermissions())) return {status: 'denied'};
    const text = (await native.recognize(locale)).trim();
    return text ? {status: 'ok', text} : {status: 'error'};
  } catch {
    return {status: 'error'};
  }
};

export const readVisitText = async (
  text: string,
  locale: string,
): Promise<boolean> => {
  const native = getModule();
  if (!native || !text.trim()) return false;
  try {
    return await native.speak(text, locale);
  } catch {
    return false;
  }
};

export const stopReadingVisitText = async (): Promise<boolean> => {
  try {
    return (await getModule()?.stopSpeaking()) ?? false;
  } catch {
    return false;
  }
};
