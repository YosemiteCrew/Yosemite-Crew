/**
 * Safe access to the assistant's native modules.
 *
 * Both modules are optional at runtime. They are absent in Jest, absent in a
 * JS-only reload before the native side registers, and the on-device model is
 * absent on every device that does not ship one. Every accessor here returns
 * null rather than throwing so a missing module degrades the feature instead
 * of crashing the app.
 */
import {NativeModules, Platform} from 'react-native';

/** Writes the offline snapshot that App Intents and shortcuts read. */
export interface AssistantSnapshotNativeModule {
  writeSnapshot(json: string): Promise<boolean>;
  clearSnapshot(): Promise<boolean>;
  /**
   * Returns a deep link parked by a handoff intent or shortcut, then clears
   * it. Resolves to an empty string when nothing is pending.
   */
  consumePendingLink(): Promise<string>;
  /** Publishes the OS-level shortcuts for the catalogue. Android only. */
  publishShortcuts?(json: string): Promise<boolean>;
}

/** Wraps the platform's on-device language model. */
export interface OnDeviceModelNativeModule {
  isAvailable(): Promise<{
    available: boolean;
    reason?: string;
    providerLabel?: string;
  }>;
  generate(prompt: string, maxTokens: number): Promise<string>;
}

const readModule = <T>(name: string): T | null => {
  const candidate = (NativeModules as Record<string, unknown>)[name];
  return candidate ? (candidate as T) : null;
};

export const getSnapshotModule = (): AssistantSnapshotNativeModule | null =>
  readModule<AssistantSnapshotNativeModule>('AssistantSnapshotBridge');

export const getOnDeviceModelModule = (): OnDeviceModelNativeModule | null =>
  readModule<OnDeviceModelNativeModule>('OnDeviceModelBridge');

/**
 * The user-facing name of the platform's assistant.
 *
 * Used in the availability banner. Kept here so the two native modules do not
 * each have to ship a localised string.
 */
export const platformProviderLabel = (): string =>
  Platform.OS === 'ios' ? 'Apple Intelligence' : 'Gemini Nano';
