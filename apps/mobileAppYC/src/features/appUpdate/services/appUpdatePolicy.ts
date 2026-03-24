import {Platform} from 'react-native';
import type {MobileConfig} from '@/shared/services/mobileConfig';

export type UpdatePromptKind = 'none' | 'optional' | 'required';

export type AppUpdatePrompt = {
  kind: Exclude<UpdatePromptKind, 'none'>;
  title?: string;
  message?: string;
  storeUrl: string | null;
  remindAfterHours: number;
  currentVersion: string;
  currentBuildNumber: number;
  latestVersion?: string;
  latestBuildNumber?: number;
  minimumSupportedVersion?: string;
  minimumSupportedBuildNumber?: number;
};

const OPTIONAL_PROMPT_DEFAULT_HOURS = 24;
const IOS_APP_STORE_URL_PREFIX = 'itms-apps://itunes.apple.com/app/id';

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return false;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const normalizeVersion = (version: string): number[] => {
  return version
    .split('.')
    .map(part => {
      const digits = part.replace(/[^0-9]/g, '');
      const parsed = Number(digits);
      return Number.isFinite(parsed) ? parsed : 0;
    })
    .slice(0, 4);
};

export const compareVersions = (left: string, right: string): number => {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const l = leftParts[index] ?? 0;
    const r = rightParts[index] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }

  return 0;
};

const resolveStoreUrl = (
  appUpdate: NonNullable<MobileConfig['appUpdate']>,
  bundleId: string,
): string | null => {
  const iosPolicy = appUpdate.ios;
  const androidPolicy = appUpdate.android;

  if (Platform.OS === 'ios') {
    const appStoreId = iosPolicy?.appStoreId ?? appUpdate.appStoreId;
    const iosUrl =
      iosPolicy?.storeUrl ?? appUpdate.iosStoreUrl ?? appUpdate.storeUrl;

    if (iosUrl) {
      return iosUrl;
    }

    if (appStoreId?.trim()) {
      return `${IOS_APP_STORE_URL_PREFIX}${appStoreId.trim()}`;
    }

    return null;
  }

  if (Platform.OS === 'android') {
    return (
      androidPolicy?.storeUrl ??
      appUpdate.androidStoreUrl ??
      appUpdate.storeUrl ??
      `market://details?id=${bundleId}`
    );
  }

  return appUpdate.storeUrl ?? null;
};

export const evaluateAppUpdatePrompt = (
  config: MobileConfig,
  appVersion: string,
  appBuildNumber: number,
  bundleId: string,
): AppUpdatePrompt | null => {
  const appUpdate = config.appUpdate;

  if (!appUpdate) return null;

  const platformPolicy =
    Platform.OS === 'ios'
      ? appUpdate.ios
      : Platform.OS === 'android'
        ? appUpdate.android
        : undefined;

  const enabled = toBoolean(platformPolicy?.enabled ?? appUpdate.enabled);
  const force = toBoolean(platformPolicy?.force ?? appUpdate.force);

  const minimumSupportedVersion =
    platformPolicy?.minimumSupportedVersion?.trim() ||
    appUpdate.minimumSupportedVersion?.trim() ||
    undefined;
  const minimumSupportedBuildNumber = toNumberOrNull(
    platformPolicy?.minimumSupportedBuildNumber ??
      appUpdate.minimumSupportedBuildNumber,
  );

  const latestVersion =
    platformPolicy?.latestVersion?.trim() ||
    appUpdate.latestVersion?.trim() ||
    undefined;
  const latestBuildNumber = toNumberOrNull(
    platformPolicy?.latestBuildNumber ?? appUpdate.latestBuildNumber,
  );

  const remindAfterHoursRaw = toNumberOrNull(
    platformPolicy?.remindAfterHours ?? appUpdate.remindAfterHours,
  );
  const remindAfterHours =
    remindAfterHoursRaw && remindAfterHoursRaw > 0
      ? remindAfterHoursRaw
      : OPTIONAL_PROMPT_DEFAULT_HOURS;

  const needsMinimumVersionUpgrade =
    !!minimumSupportedVersion &&
    compareVersions(appVersion, minimumSupportedVersion) < 0;
  const needsMinimumBuildUpgrade =
    minimumSupportedBuildNumber !== null &&
    appBuildNumber < minimumSupportedBuildNumber;

  const mustUpdate =
    force || needsMinimumVersionUpgrade || needsMinimumBuildUpgrade;

  const hasNewerLatestVersion =
    !!latestVersion && compareVersions(appVersion, latestVersion) < 0;
  const hasNewerLatestBuild =
    latestBuildNumber !== null && appBuildNumber < latestBuildNumber;

  const shouldSuggestUpdate =
    enabled && (hasNewerLatestVersion || hasNewerLatestBuild);

  if (!mustUpdate && !shouldSuggestUpdate) {
    return null;
  }

  return {
    kind: mustUpdate ? 'required' : 'optional',
    title: platformPolicy?.title ?? appUpdate.title,
    message: platformPolicy?.message ?? appUpdate.message,
    storeUrl: resolveStoreUrl(appUpdate, bundleId),
    remindAfterHours,
    currentVersion: appVersion,
    currentBuildNumber: appBuildNumber,
    latestVersion,
    latestBuildNumber: latestBuildNumber ?? undefined,
    minimumSupportedVersion,
    minimumSupportedBuildNumber: minimumSupportedBuildNumber ?? undefined,
  };
};

export const getCurrentAppIdentity = () => {
  try {
    // Lazy load keeps pure policy tests runnable in Jest (no native module init).
    const module = require('react-native-device-info') as {
      default?: {
        getVersion: () => string;
        getBuildNumber: () => string;
        getBundleId: () => string;
      };
      getVersion?: () => string;
      getBuildNumber?: () => string;
      getBundleId?: () => string;
    };

    const deviceInfo = module.default ?? module;
    const currentVersion = deviceInfo.getVersion?.() ?? '0.0.0';
    const buildNumberRaw = deviceInfo.getBuildNumber?.() ?? '0';
    const parsedBuildNumber = Number(buildNumberRaw);
    const currentBuildNumber = Number.isFinite(parsedBuildNumber)
      ? parsedBuildNumber
      : 0;
    const bundleId = deviceInfo.getBundleId?.() ?? 'unknown.bundle.id';

    return {
      currentVersion,
      currentBuildNumber,
      bundleId,
    };
  } catch {
    return {
      currentVersion: '0.0.0',
      currentBuildNumber: 0,
      bundleId: 'unknown.bundle.id',
    };
  }
};

export const shouldShowOptionalPrompt = (
  lastPromptedAtIso: string | null,
  remindAfterHours: number,
  now: Date = new Date(),
): boolean => {
  if (!lastPromptedAtIso) return true;

  const lastPromptedAt = new Date(lastPromptedAtIso);
  if (Number.isNaN(lastPromptedAt.getTime())) return true;

  const nextPromptAt =
    lastPromptedAt.getTime() + remindAfterHours * 60 * 60 * 1000;

  return now.getTime() >= nextPromptAt;
};
