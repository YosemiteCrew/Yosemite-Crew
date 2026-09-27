import {NativeModules, Platform} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

interface VisitVoiceNativeModule {
  isAvailable(): Promise<boolean>;
  recognize(locale: string): Promise<string>;
  speak(text: string, locale: string): Promise<boolean>;
  stopSpeaking(): Promise<boolean>;
}

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
